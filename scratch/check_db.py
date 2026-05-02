import sqlite3
import os

db_path = "backend/app.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT session_id, expires_at FROM tokens")
        rows = cursor.fetchall()
        for row in rows:
            print(f"Session: {row[0]}, Expires: {row[1]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print("Database file not found.")
