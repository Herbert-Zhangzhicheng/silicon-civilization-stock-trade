import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSUMPTION_DOMAINS, getConsumptionDomain } from "../lib/consumption";

test("consumption domains cover the silicon-life ledger", () => {
  assert.deepEqual(
    CONSUMPTION_DOMAINS.map((domain) => domain.short),
    ["算", "存", "光", "电", "封"],
  );
});

test("known themes map into the expected consumption domains", () => {
  assert.equal(getConsumptionDomain("算力/AI芯片").short, "算");
  assert.equal(getConsumptionDomain("存储/HBM").short, "存");
  assert.equal(getConsumptionDomain("光模块").short, "光");
  assert.equal(getConsumptionDomain("液冷").short, "电");
  assert.equal(getConsumptionDomain("半导体设备").short, "封");
});
