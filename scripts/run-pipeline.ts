// Local script to trigger the pipeline without a running Next.js server.
// Usage: npm run pipeline
import { runPipeline } from "../pipeline/run";

(async () => {
  console.log("Starting Briefed pipeline...\n");
  try {
    const result = await runPipeline();
    console.log("\nPipeline complete:", result);
    process.exit(0);
  } catch (err) {
    console.error("\nPipeline failed with unhandled error:", err);
    process.exit(1);
  }
})();
