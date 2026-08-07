from app import create_app
from app.database import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    cols = [
        ('shop_name_font_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'),
        ('shop_name_font', "VARCHAR(100) NOT NULL DEFAULT 'Outfit'"),
        ('shop_name_font_size', 'INT NOT NULL DEFAULT 32'),
        ('shop_name_font_weight', "VARCHAR(20) NOT NULL DEFAULT '700'"),
        ('shop_name_letter_spacing', 'DECIMAL(4,2) NOT NULL DEFAULT 0.00'),
    ]
    for c, s in cols:
        check = db.session.execute(text(f"SHOW COLUMNS FROM tenant_settings LIKE '{c}'")).fetchone()
        if not check:
            db.session.execute(text(f"ALTER TABLE tenant_settings ADD COLUMN {c} {s}"))
            print(f"Added column {c} to tenant_settings table.")
        else:
            print(f"Column {c} already exists.")
    db.session.commit()
    print("Database migration completed successfully!")
