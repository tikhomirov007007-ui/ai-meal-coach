import { pool, migrate } from "./index";

migrate()
  .then(() => {
    console.log("Database migrated successfully");
    return pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
