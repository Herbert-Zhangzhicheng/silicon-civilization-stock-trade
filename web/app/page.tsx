import Link from "next/link";
import { CONSUMPTION_DOMAINS, LIFE_WORKFLOW, getConsumptionDomain, getConsumptionDomainById } from "@/lib/consumption";
import { readUniverse } from "@/lib/universe";
import RefreshUniverseButton from "./RefreshUniverseButton";
import UniverseTable from "./UniverseTable";

export const dynamic = "force-dynamic";

export default function Home() {
  const universe = readUniverse();
  const entries = universe.entries;
  const globalCount = entries.filter((e) => e.global_supply).length;
  const themeCount = new Set(entries.map((e) => e.theme)).size;
  const domainStats = new Map(
    CONSUMPTION_DOMAINS.map((domain) => [domain.id, { count: 0, themes: new Set<string>() }]),
  );
  for (const entry of entries) {
    const domain = getConsumptionDomain(entry.theme);
    const stat = domainStats.get(domain.id);
    if (stat) {
      stat.count += 1;
      stat.themes.add(entry.theme);
    }
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <div className="eyebrow">DeepSeek · Tushare · 硅基生命工作流</div>
          <h1>硅基生命消费股交易系统</h1>
          <p>
            把 AI 算力体视为一种会工作、会代谢、会扩张的硅基生命：它先保存状态，再计算行动，
            通过光互连协同，用供电与散热维持体征，靠封装互连封成系统身体，再由制造链复制更多身体。
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
            <h2 id="life-ledger-title">硅基生命工作循环</h2>
            <p>不是人类消费 AI 产品，而是智能体为了存在、协同和扩张而反复消耗底层资源。</p>
          </div>
        </div>
        <div className="work-grid">
          {LIFE_WORKFLOW.map((stage) => {
            const domain = getConsumptionDomainById(stage.domainId);
            return (
              <div key={stage.step} className={`work-card domain-${domain.id}`}>
                <span className="work-step">{stage.step}</span>
                <strong>{stage.title}</strong>
                <p>{stage.description}</p>
                <span className="work-domain">{domain.short} · {domain.verb}</span>
              </div>
            );
          })}
        </div>
        <div className="domain-grid">
          {CONSUMPTION_DOMAINS.map((domain) => {
            const stat = domainStats.get(domain.id);
            return (
              <div key={domain.id} className={`domain-card domain-${domain.id}`}>
                <div className="domain-symbol">{domain.short}</div>
                <div className="domain-copy">
                  <div className="domain-title">
                    <strong>{domain.name}</strong>
                    <span>{stat?.count ?? 0} 只</span>
                  </div>
                  <p>{domain.thesis}</p>
                  <div className="domain-line"><span>工作</span>{domain.work}</div>
                  <div className="domain-line"><span>消费</span>{domain.consumes}</div>
                  <div className="domain-line"><span>瓶颈</span>{domain.bottleneck}</div>
                  <div className="theme-chips">
                    {[...(stat?.themes ?? [])].map((theme) => (
                      <span key={theme}>{theme}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
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
