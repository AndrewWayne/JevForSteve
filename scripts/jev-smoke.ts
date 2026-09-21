import { buildJevRequest, requestDecision } from "../src/core/jev";
import { syntheticContext } from "../fixtures/jev";
const model = process.env.TYPESAFE_MODEL ?? "jev-latest";
if (process.argv.includes("--dry-run"))
  console.log(
    JSON.stringify(buildJevRequest(syntheticContext, model), null, 2),
  );
else {
  try {
    const result = await requestDecision(
      syntheticContext,
      process.env.TYPESAFE_API_KEY ?? "",
      model,
    );
    console.log(JSON.stringify({ syntheticInput: true, ...result }, null, 2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
