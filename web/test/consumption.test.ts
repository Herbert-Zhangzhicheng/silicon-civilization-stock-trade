import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSUMPTION_DOMAINS, LIFE_WORKFLOW, getConsumptionDomain } from "../lib/consumption";

test("consumption domains cover the silicon-life ledger", () => {
  assert.deepEqual(
    CONSUMPTION_DOMAINS.map((domain) => domain.short),
    ["算", "存", "光", "电", "封", "造"],
  );
});

test("life workflow follows the work-before-consumption narrative", () => {
  assert.deepEqual(
    LIFE_WORKFLOW.map((stage) => stage.domainId),
    ["memory", "compute", "optics", "power", "package", "manufacture"],
  );
});

test("known themes map into the expected consumption domains", () => {
  assert.equal(getConsumptionDomain("算力/AI芯片").short, "算");
  assert.equal(getConsumptionDomain("存储/HBM").short, "存");
  assert.equal(getConsumptionDomain("光模块").short, "光");
  assert.equal(getConsumptionDomain("液冷").short, "电");
  assert.equal(getConsumptionDomain("MLCC/被动元件").short, "电");
  assert.equal(getConsumptionDomain("AIDC供配电").short, "电");
  assert.equal(getConsumptionDomain("备用电源/燃机").short, "电");
  assert.equal(getConsumptionDomain("先进封装").short, "封");
  assert.equal(getConsumptionDomain("AI服务器").short, "封");
  assert.equal(getConsumptionDomain("半导体设备").short, "造");
  assert.equal(getConsumptionDomain("晶圆代工").short, "造");
  assert.equal(getConsumptionDomain("AI-PCB").short, "封");
});
