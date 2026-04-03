export const version = 9;

export function up(db) {
  db.exec(`ALTER TABLE glances_config ADD COLUMN selected_devices TEXT`);
}
