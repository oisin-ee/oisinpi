import { emptyParameters, emptyResult, runtimeFixture } from "./runtime-fixture.ts";
import { branchSnapshot } from "./state.ts";
import { firstId } from "./contract-fixture.ts";

/**
 * Owns the controlled execution boundary used by lease regressions.
 * @param {boolean} nested Runs through real codemode when true.
 * @param {boolean} fail Throws at the actual execute boundary when true.
 * @returns {Promise<object>} Running tool and deterministic completion controls.
 */
const leased = async (
  nested: boolean,
  fail: boolean,
): Promise<{
  test: Awaited<ReturnType<typeof runtimeFixture>>;
  id: string;
  calls: readonly string[];
  finish: () => Promise<void>;
  close: () => void;
}> => {
  const entered = Promise.withResolvers<boolean>(),
    finished = Promise.withResolvers<boolean>(),
    calls: string[] = [],
    test = await runtimeFixture((pi) => {
      pi.registerTool({
        description: "Controlled mutation",
        execute: async (id) => {
          calls.push(id);
          entered.resolve(true);
          await finished.promise;
          if (fail) {
            throw new Error("Mutation failed");
          }
          return emptyResult();
        },
        label: "Mutation",
        name: "mutation",
        parameters: emptyParameters,
      });
    });
  await test.create();
  const id = firstId(branchSnapshot(test.manager.getBranch())),
    running = nested
      ? test.call("codemode", { code: "return await tools.mutation({})" })
      : test.call("mutation", {});
  await entered.promise;
  return {
    calls,
    close: (): void => {
      finished.resolve(true);
      test.session.dispose();
    },
    finish: async (): Promise<void> => {
      finished.resolve(true);
      await running;
    },
    id,
    test,
  };
};

export { leased };
