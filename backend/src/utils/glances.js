/**
 * Glances REST API v4 fetch utility.
 * Proxies requests from ServerStack backend to remote Glances instances.
 */

const GLANCES_API_VERSION = 4;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Validate that a URL is http or https only (SSRF prevention).
 * @param {string} url
 * @returns {boolean}
 */
export function isValidGlancesUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch with timeout using AbortController.
 * @param {string} url
 * @param {object} opts
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get a Glances JWT token for authenticated instances.
 * @param {string} baseUrl
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string|null>} Bearer token or null
 */
async function getGlancesToken(baseUrl, username, password) {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/${GLANCES_API_VERSION}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Build headers for Glances requests.
 * @param {string|null} token
 * @returns {object}
 */
function buildHeaders(token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch a single Glances plugin endpoint. Returns null on error.
 * @param {string} baseUrl
 * @param {string} plugin - e.g. 'cpu', 'mem', 'sensors'
 * @param {object} headers
 * @returns {Promise<any>}
 */
async function fetchPlugin(baseUrl, plugin, headers) {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/${GLANCES_API_VERSION}/${plugin}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extract CPU temperature from sensors data.
 * Looks for sensors with type 'temperature_core' and label containing CPU/Package/Core.
 * Returns the highest relevant temperature found.
 * @param {Array} sensors
 * @param {Array<string>|null} selectedSensors - Optional list of selected sensor labels
 * @returns {number|null}
 */
function extractCpuTemp(sensors, selectedSensors = null) {
  if (!Array.isArray(sensors)) return null;
  let filtered = sensors.filter(s =>
    s.type === 'temperature_core' &&
    /cpu|package|core/i.test(s.label)
  );
  if (selectedSensors?.length > 0) {
    filtered = filtered.filter(s => selectedSensors.includes(s.label));
  }
  if (filtered.length === 0) return null;
  return Math.max(...filtered.map(s => s.value));
}

/**
 * Aggregate network interface stats.
 * Sums rates and cumulative across selected (or all non-loopback, non-docker) interfaces.
 * @param {Array} network
 * @param {Array<string>|null} selectedInterfaces - Optional list of selected interface names
 * @returns {{ rx_rate: number, tx_rate: number, cumulative_rx: number, cumulative_tx: number }}
 */
function aggregateNetwork(network, selectedInterfaces = null) {
  const result = { rx_rate: 0, tx_rate: 0, cumulative_rx: 0, cumulative_tx: 0 };
  if (!Array.isArray(network)) return result;
  for (const iface of network) {
    if (selectedInterfaces?.length > 0) {
      if (!selectedInterfaces.includes(iface.interface_name)) continue;
    } else {
      // Default: skip loopback & docker virtual interfaces
      if (/^lo$|^docker|^veth|^br-/i.test(iface.interface_name)) continue;
    }
    result.rx_rate += iface.bytes_recv_rate_per_sec || iface.bytes_recv || 0;
    result.tx_rate += iface.bytes_sent_rate_per_sec || iface.bytes_sent || 0;
    result.cumulative_rx += iface.bytes_recv_gauge || 0;
    result.cumulative_tx += iface.bytes_sent_gauge || 0;
  }
  return result;
}

/**
 * Normalize filesystem data into a compact array.
 * @param {Array} fs
 * @param {Array<string>|null} selectedPartitions - Optional list of selected mount points
 * @returns {Array<{ mnt_point: string, device: string, fs_type: string, size: number, used: number, free: number, percent: number }>}
 */
function normalizeDiskUsage(fs, selectedPartitions = null) {
  if (!Array.isArray(fs)) return [];
  let filtered = fs;
  if (selectedPartitions?.length > 0) {
    filtered = fs.filter(d => selectedPartitions.includes(d.mnt_point));
  }
  return filtered.map(d => ({
    mnt_point: d.mnt_point,
    device: d.device_name,
    fs_type: d.fs_type,
    size: d.size,
    used: d.used,
    free: d.free,
    percent: d.percent,
  }));
}

/**
 * Normalize GPU data.
 * @param {Array} gpus
 * @param {Array<number>|null} selectedGpus - Optional list of selected gpu_id values
 * @returns {Array|null}
 */
function normalizeGpuData(gpus, selectedGpus = null) {
  if (!Array.isArray(gpus) || gpus.length === 0) return null;
  let filtered = gpus;
  if (selectedGpus?.length > 0) {
    filtered = gpus.filter(g => selectedGpus.includes(g.gpu_id));
  }
  if (filtered.length === 0) return null;
  return filtered.map(g => ({
    gpu_id: g.gpu_id,
    name: g.name,
    proc: g.proc,
    mem: g.mem,
    temperature: g.temperature,
    fan_speed: g.fan_speed,
  }));
}

/**
 * Check if a Glances instance is reachable.
 * @param {string} glancesUrl
 * @param {string|null} username
 * @param {string|null} password
 * @returns {Promise<{ ok: boolean, version: string|null, error: string|null }>}
 */
export async function checkGlancesConnection(glancesUrl, username, password) {
  if (!isValidGlancesUrl(glancesUrl)) {
    return { ok: false, version: null, error: 'Invalid URL — must be http:// or https://' };
  }

  try {
    let token = null;
    if (username && password) {
      token = await getGlancesToken(glancesUrl, username, password);
      if (!token) {
        return { ok: false, version: null, error: 'Authentication failed' };
      }
    }

    const headers = buildHeaders(token);
    const [statusRes, versionData] = await Promise.all([
      fetchWithTimeout(`${glancesUrl}/api/${GLANCES_API_VERSION}/status`, { headers }),
      fetchPlugin(glancesUrl, 'version', headers),
    ]);

    if (!statusRes.ok) {
      return { ok: false, version: null, error: `Status check failed: HTTP ${statusRes.status}` };
    }

    return { ok: true, version: versionData || null, error: null };
  } catch (err) {
    return { ok: false, version: null, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
  }
}

/**
 * Discover available devices from a Glances instance.
 * Returns lists of network interfaces, disk partitions, sensors, and GPUs.
 * @param {string} glancesUrl
 * @param {string|null} username
 * @param {string|null} password
 * @returns {Promise<{ ok: boolean, devices: object|null, error: string|null }>}
 */
export async function discoverGlancesDevices(glancesUrl, username, password) {
  if (!isValidGlancesUrl(glancesUrl)) {
    return { ok: false, devices: null, error: 'Invalid URL' };
  }

  try {
    let token = null;
    if (username && password) {
      token = await getGlancesToken(glancesUrl, username, password);
      if (!token) {
        return { ok: false, devices: null, error: 'Authentication failed' };
      }
    }

    const headers = buildHeaders(token);

    const [network, fs, sensors, gpu] = await Promise.all([
      fetchPlugin(glancesUrl, 'network', headers),
      fetchPlugin(glancesUrl, 'fs', headers),
      fetchPlugin(glancesUrl, 'sensors', headers),
      fetchPlugin(glancesUrl, 'gpu', headers),
    ]);

    const devices = {
      network_interfaces: Array.isArray(network)
        ? network.map(iface => ({
            name: iface.interface_name,
            alias: iface.alias || null,
            is_up: iface.is_up ?? true,
            speed: iface.speed ?? null,
          }))
        : [],
      disk_partitions: Array.isArray(fs)
        ? fs.map(d => ({
            device: d.device_name,
            mnt_point: d.mnt_point,
            fs_type: d.fs_type,
            size: d.size,
          }))
        : [],
      sensors: Array.isArray(sensors)
        ? sensors.map(s => ({
            label: s.label,
            type: s.type,
            value: s.value,
            unit: s.unit || '',
          }))
        : [],
      gpus: Array.isArray(gpu)
        ? gpu.map(g => ({
            gpu_id: g.gpu_id,
            name: g.name,
            proc: g.proc,
            mem: g.mem,
          }))
        : [],
    };

    return { ok: true, devices, error: null };
  } catch (err) {
    return { ok: false, devices: null, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
  }
}

/**
 * Fetch all monitoring data from a Glances instance.
 * @param {string} glancesUrl
 * @param {string|null} username
 * @param {string|null} password
 * @param {object|null} selectedDevices - Optional device filter
 * @returns {Promise<{ ok: boolean, data: object|null, error: string|null }>}
 */
export async function fetchGlancesData(glancesUrl, username, password, selectedDevices = null) {
  if (!isValidGlancesUrl(glancesUrl)) {
    return { ok: false, data: null, error: 'Invalid URL' };
  }

  try {
    let token = null;
    if (username && password) {
      token = await getGlancesToken(glancesUrl, username, password);
      if (!token) {
        return { ok: false, data: null, error: 'Authentication failed' };
      }
    }

    const headers = buildHeaders(token);

    // Fetch all plugins in parallel
    const [cpu, sensors, mem, memswap, network, fs, gpu, uptime, load, system] = await Promise.all([
      fetchPlugin(glancesUrl, 'cpu', headers),
      fetchPlugin(glancesUrl, 'sensors', headers),
      fetchPlugin(glancesUrl, 'mem', headers),
      fetchPlugin(glancesUrl, 'memswap', headers),
      fetchPlugin(glancesUrl, 'network', headers),
      fetchPlugin(glancesUrl, 'fs', headers),
      fetchPlugin(glancesUrl, 'gpu', headers),
      fetchPlugin(glancesUrl, 'uptime', headers),
      fetchPlugin(glancesUrl, 'load', headers),
      fetchPlugin(glancesUrl, 'system', headers),
    ]);

    const net = aggregateNetwork(network, selectedDevices?.network_interfaces);

    const data = {
      cpu_percent: cpu?.total ?? null,
      cpu_temp: extractCpuTemp(sensors, selectedDevices?.sensors),
      ram_total: mem?.total ?? null,
      ram_used: mem?.used ?? null,
      ram_percent: mem?.percent ?? null,
      swap_total: memswap?.total ?? null,
      swap_used: memswap?.used ?? null,
      swap_percent: memswap?.percent ?? null,
      net_rx_rate: net.rx_rate,
      net_tx_rate: net.tx_rate,
      net_cumulative_rx: net.cumulative_rx,
      net_cumulative_tx: net.cumulative_tx,
      disk_usage: normalizeDiskUsage(fs, selectedDevices?.disk_partitions),
      gpu: normalizeGpuData(gpu, selectedDevices?.gpus),
      uptime: uptime || null,
      load_1: load?.min1 ?? null,
      load_5: load?.min5 ?? null,
      load_15: load?.min15 ?? null,
      system: system || null,
    };

    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
  }
}
