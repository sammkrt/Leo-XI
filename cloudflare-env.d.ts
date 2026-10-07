declare namespace Cloudflare {
  interface Env {
    CLUB_STORE: DurableObjectNamespace;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
