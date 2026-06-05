import Link from "next/link";
import { CONSUMPTION_DOMAINS, getConsumptionDomain } from "@/lib/consumption";
import { readUniverse } from "@/lib/universe";
import RefreshUniverseButton from "./RefreshUniverseButton";
import UniverseTable from "./UniverseTable";

export const dynamic = "force-dynamic";

export default function Home() {
  const universe = readUniverse();
  const entries = universe.entries;
  const globalCount = entries.filter((e) => e.global_supply).length;
  const themeCount = new Set(entries.map((e) => e.theme)).size;
  const domainCounts = new Map(
    CONSUMPTION_DOMAINS.map((domain) => [domain.id, 0]),
  );
  for (const entry of entries) {
    const domain = getConsumptionDomain(entry.theme);
    domainCounts.set(domain.id, (domainCounts.get(domain.id) ?? 0) + 1);
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <div className="eyebrow">DeepSeek · Tushare · 存算光电封</div>
          <h1>硅基生命消费股交易系统</h1>
          <p>
            从硅基生命的视角，把 AI 基础设施拆成记忆、计算、互连、能量和封装制造五类长期消耗，
            跟踪它们在 A 股供应链中的可交易标的。
          </p>
        </div>
        <div className="header-actions">
          <Link href="/signals" className="button secondary">实时信号</Link>
          <Link href="/backtest" className="button secondary">策略回测</Link>
        </div>
      </header>

      <div className="summary-grid">
        <div className="metric">
          <span className="label">股票池</span>
          <strong>{entries.length}</strong>
          <span>仅 A 股</span>
        </div>
        <div className="metric">
          <span className="label">全球供应链</span>
          <strong>{globalCount}</strong>
          <span>{Math.round((globalCount / Math.max(entries.length, 1)) * 100)}% 覆盖</span>
        </div>
        <div className="metric">
          <span className="label">子主题</span>
          <strong>{themeCount}</strong>
          <span>按产业环节分组</span>
        </div>
        <div className="metric">
          <span className="label">更新时间</span>
          <strong>{universe.updated_at}</strong>
          <span>{universe.updated_by}</span>
        </div>
      </div>

      <section className="life-ledger" aria-labelledby="life-ledger-title">
        <div className="section-heading inline-heading">
          <div>
            <h2 id="life-ledger-title">硅基生命消费账本</h2>
            <p>不是人类消费 AI 产品，而是假设智能体持续运行、扩张和迭代时会反复购买的基础资源。</p>
          </div>
        </div>
        <div className="domain-grid">
          {CONSUMPTION_DOMAINS.map((domain) => (
            <div key={domain.id} className={`domain-card domain-${domain.id}`}>
              <div className="domain-symbol">{domain.short}</div>
              <div className="domain-copy">
                <div className="domain-title">
                  <strong>{domain.name}</strong>
                  <span>{domainCounts.get(domain.id) ?? 0} 只</span>
                </div>
                <p>{domain.thesis}</p>
                <div className="domain-demand">{domain.demand}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h2>股票池</h2>
          <p>按消费领域、产业主题、全球供应链和上行空间筛选。</p>
        </div>
        <RefreshUniverseButton />
      </div>

      <UniverseTable entries={entries} />
    </div>
  );
}
