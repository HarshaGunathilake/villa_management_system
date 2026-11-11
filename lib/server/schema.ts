import type { Db } from "./db";

/**
 * Database tables. Every villa-specific table carries villa_id and uses
 * (villa_id, id) as its key, so a record can only ever be reached through the
 * villa it belongs to.
 */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS villas (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    location VARCHAR(160) NOT NULL DEFAULT '',
    phone VARCHAR(40) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    address VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NULL,
    max_guests INT NOT NULL DEFAULT 8,
    price INT NOT NULL DEFAULT 0,
    check_in_time CHAR(5) NOT NULL DEFAULT '14:00',
    check_out_time CHAR(5) NOT NULL DEFAULT '11:00',
    plan VARCHAR(40) NOT NULL DEFAULT 'Standard',
    monthly_subscription_amount INT NOT NULL DEFAULT 0,
    subscription_status ENUM('active','payment_due','overdue') NOT NULL DEFAULT 'active',
    account_status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    subscription_start_date DATE NOT NULL,
    next_payment_date DATE NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    villa_id VARCHAR(40) NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(40) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin','villa_admin') NOT NULL,
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY users_email (email),
    KEY users_villa (villa_id),
    CONSTRAINT users_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    KEY sessions_user (user_id),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_payments (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    villa_id VARCHAR(40) NOT NULL,
    amount INT NOT NULL,
    payment_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'paid',
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_by VARCHAR(40) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY payments_villa (villa_id),
    CONSTRAINT payments_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    villa_id VARCHAR(40) NULL,
    action VARCHAR(60) NOT NULL,
    detail VARCHAR(255) NOT NULL,
    created_by VARCHAR(40) NULL,
    created_at DATETIME NOT NULL,
    KEY activity_villa (villa_id)
  )`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    name VARCHAR(60) NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rooms (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    view VARCHAR(160) NOT NULL DEFAULT '',
    capacity INT NOT NULL DEFAULT 2,
    price INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    photo VARCHAR(500) NULL,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (villa_id, id),
    CONSTRAINT rooms_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS guests (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL DEFAULT '',
    email VARCHAR(190) NULL,
    country VARCHAR(80) NULL,
    position BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (villa_id, id),
    KEY guests_position (position),
    CONSTRAINT guests_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    seq BIGINT NOT NULL AUTO_INCREMENT,
    type ENUM('villa','room') NOT NULL,
    room_id VARCHAR(40) NULL,
    guest_id VARCHAR(40) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    check_in_time CHAR(5) NULL,
    check_out_time CHAR(5) NULL,
    adults INT NOT NULL DEFAULT 1,
    children INT NOT NULL DEFAULT 0,
    source VARCHAR(30) NOT NULL DEFAULT 'Direct',
    extras TEXT NULL,
    total INT NOT NULL DEFAULT 0,
    paid INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    status ENUM('confirmed','checked_in','checked_out','cancelled') NOT NULL DEFAULT 'confirmed',
    created_on DATE NOT NULL,
    checked_out_on DATE NULL,
    PRIMARY KEY (villa_id, id),
    KEY bookings_seq (seq),
    KEY bookings_dates (villa_id, check_in, check_out),
    CONSTRAINT bookings_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(30) NOT NULL,
    amount INT NOT NULL,
    date DATE NOT NULL,
    note VARCHAR(500) NULL,
    receipt_name VARCHAR(255) NULL,
    position BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (villa_id, id),
    KEY expenses_position (position),
    CONSTRAINT expenses_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS amenities (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    price INT NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'per booking',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    position BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (villa_id, id),
    KEY amenities_position (position),
    CONSTRAINT amenities_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
];

// Card payments (Dodo Payments)
TABLES.push(
  // One Dodo product per monthly amount, reused by every villa on that amount.
  `CREATE TABLE IF NOT EXISTS dodo_products (
    mode VARCHAR(12) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount INT NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (mode, currency, amount)
  )`,
  // Every webhook handled, so a repeated delivery is not counted twice.
  `CREATE TABLE IF NOT EXISTS dodo_webhook_events (
    webhook_id VARCHAR(100) NOT NULL PRIMARY KEY,
    type VARCHAR(60) NOT NULL,
    received_at DATETIME NOT NULL
  )`,
  // Password reset links. Only a hash of the token is kept; each one works once, for an hour.
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    KEY password_resets_user (user_id),
    CONSTRAINT password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // One-time links that prove a new villa owner owns their email address.
  `CREATE TABLE IF NOT EXISTS email_verifications (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL,
    email VARCHAR(190) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    KEY email_verifications_user (user_id),
    CONSTRAINT email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // People who asked to hear when the site opens (the Coming soon page).
  `CREATE TABLE IF NOT EXISTS waitlist (
    email VARCHAR(190) NOT NULL PRIMARY KEY,
    created_at DATETIME NOT NULL
  )`,
  // People who work at a villa, and the payslips made for them.
  `CREATE TABLE IF NOT EXISTS staff (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(80) NOT NULL DEFAULT '',
    phone VARCHAR(40) NOT NULL DEFAULT '',
    pay_type ENUM('monthly','daily') NOT NULL,
    rate INT NOT NULL DEFAULT 0,
    epf TINYINT(1) NOT NULL DEFAULT 0,
    epf_number VARCHAR(40) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    position BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (villa_id, id),
    KEY staff_position (position),
    CONSTRAINT staff_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS payslips (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    number INT NOT NULL,
    staff_id VARCHAR(40) NOT NULL,
    staff_name VARCHAR(120) NOT NULL,
    staff_role VARCHAR(80) NOT NULL DEFAULT '',
    pay_type ENUM('monthly','daily') NOT NULL,
    rate INT NOT NULL,
    month CHAR(7) NOT NULL,
    days INT NULL,
    additions TEXT NULL,
    deductions TEXT NULL,
    epf TINYINT(1) NOT NULL DEFAULT 0,
    epf_number VARCHAR(40) NULL,
    note VARCHAR(500) NULL,
    created_on DATE NOT NULL,
    paid_on DATE NULL,
    expense_id VARCHAR(40) NULL,
    PRIMARY KEY (villa_id, id),
    UNIQUE KEY payslips_number (villa_id, number),
    KEY payslips_month (villa_id, month),
    CONSTRAINT payslips_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  // Which monthly reports have gone out, so a month is never emailed twice.
  // Bills that come round again (electricity, water, internet...), and each time one was paid or skipped.
  `CREATE TABLE IF NOT EXISTS bills (
    villa_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(30) NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    repeat_every ENUM('monthly','quarterly','yearly') NOT NULL DEFAULT 'monthly',
    due_day TINYINT NOT NULL,
    start_month CHAR(7) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    note VARCHAR(500) NULL,
    position BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (villa_id, id),
    KEY bills_position (position),
    CONSTRAINT bills_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS bill_payments (
    villa_id VARCHAR(40) NOT NULL,
    bill_id VARCHAR(40) NOT NULL,
    period CHAR(7) NOT NULL,
    paid_on DATE NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    expense_id VARCHAR(40) NULL,
    skipped TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (villa_id, bill_id, period),
    KEY bill_payments_expense (villa_id, expense_id),
    CONSTRAINT bill_payments_bill_fk FOREIGN KEY (villa_id, bill_id) REFERENCES bills (villa_id, id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS monthly_reports_sent (
    villa_id VARCHAR(40) NOT NULL,
    month CHAR(7) NOT NULL,
    sent_at DATETIME NOT NULL,
    PRIMARY KEY (villa_id, month),
    CONSTRAINT monthly_reports_villa_fk FOREIGN KEY (villa_id) REFERENCES villas (id) ON DELETE CASCADE
  )`,
  // Every email the platform tried to send, for the Super Admin to check.
  `CREATE TABLE IF NOT EXISTS email_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(40) NOT NULL,
    to_email VARCHAR(190) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status ENUM('sent','failed','skipped') NOT NULL,
    error VARCHAR(500) NULL,
    villa_id VARCHAR(40) NULL,
    created_at DATETIME NOT NULL,
    KEY email_log_created (created_at)
  )`,
);

/** Columns added after the first release. Existing databases get them on the next start. */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  // Why access is off: 'manual' (the Super Admin) or 'subscription' (Dodo ended the subscription)
  ["villas", "disabled_reason", "VARCHAR(20) NULL"],
  ["villas", "dodo_customer_id", "VARCHAR(64) NULL"],
  ["villas", "dodo_subscription_id", "VARCHAR(64) NULL"],
  ["villas", "dodo_status", "VARCHAR(30) NULL"],
  ["subscription_payments", "dodo_payment_id", "VARCHAR(64) NULL"],
  // 1 while a self sign-up has not clicked the link in its verification email. Everyone else counts as verified.
  ["users", "email_unverified", "TINYINT(1) NOT NULL DEFAULT 0"],
  // 1 until a new villa owner has seen (or skipped) the first-time guide. Existing owners never see it.
  ["users", "tour_pending", "TINYINT(1) NOT NULL DEFAULT 0"],
  // The name the product was given in Dodo (shown on the checkout page), so it can follow the platform name.
  ["dodo_products", "name", "VARCHAR(120) NULL"],
  // The owner's choice to get last month's report by email on the 1st, and an extra address for it.
  ["villas", "monthly_report", "TINYINT(1) NOT NULL DEFAULT 0"],
  ["villas", "report_cc", "VARCHAR(190) NULL"],
  // Free trial: the days a self sign-up was offered when it registered, and when its trial ends (set once the card is added).
  ["villas", "trial_days", "SMALLINT NULL"],
  ["villas", "trial_ends_on", "DATE NULL"],
  // The day the trial-ending reminder went out, so it is sent once.
  ["villas", "trial_reminder_sent", "DATE NULL"],
  // Free access the Super Admin gave without a card: the last free day. The villa switches off after it.
  ["villas", "free_until", "DATE NULL"],
  // The card subscription is set to end at the end of the paid month (by the owner in Dodo, or the Super Admin).
  ["villas", "cancel_at_period_end", "TINYINT(1) NOT NULL DEFAULT 0"],
];

const ADDED_INDEXES: [table: string, name: string, ddl: string][] = [
  ["villas", "villas_dodo_subscription", "UNIQUE KEY villas_dodo_subscription (dodo_subscription_id)"],
  ["subscription_payments", "payments_dodo_payment", "UNIQUE KEY payments_dodo_payment (dodo_payment_id)"],
];

async function upgrade(db: Db) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const found = await db.one("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, column]);
    if (!found) await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
  for (const [table, name, ddl] of ADDED_INDEXES) {
    const found = await db.one("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?", [table, name]);
    if (!found) await db.run(`ALTER TABLE ${table} ADD ${ddl}`);
  }
  // Villas switched off before reasons were kept were switched off by hand.
  await db.run("UPDATE villas SET disabled_reason = 'manual' WHERE account_status = 'disabled' AND disabled_reason IS NULL");
  // The platform was renamed LankaStay. A name the Super Admin set themselves is left alone.
  await db.run("UPDATE platform_settings SET value = 'LankaStay' WHERE name = 'platformName' AND value = 'Villa Stay Manager'");
}

export const TABLE_NAMES = ["bill_payments", "bills", "monthly_reports_sent", "payslips", "staff", "waitlist", "email_log", "email_verifications", "password_resets", "dodo_webhook_events", "dodo_products", "amenities", "expenses", "bookings", "guests", "rooms", "platform_settings", "activity_log", "subscription_payments", "sessions", "users", "villas"];

export async function createSchema(db: Db) {
  for (const ddl of TABLES) await db.run(ddl);
  await upgrade(db);
}
