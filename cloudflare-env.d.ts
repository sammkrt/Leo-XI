declare namespace Cloudflare {
  interface Env {
    CLUB_STORE: DurableObjectNamespace;
    GITHUB_DISPATCH_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
