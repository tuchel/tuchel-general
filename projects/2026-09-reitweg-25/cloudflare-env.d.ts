declare namespace Cloudflare {
  interface Env {
    STUDIO_OWNER_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
