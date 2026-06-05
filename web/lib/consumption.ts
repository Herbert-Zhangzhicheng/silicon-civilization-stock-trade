export type ConsumptionDomainId = "compute" | "memory" | "optics" | "power" | "package";

export interface ConsumptionDomain {
  id: ConsumptionDomainId;
  short: string;
  name: string;
  thesis: string;
  demand: string;
  themes: string[];
}

export const CONSUMPTION_DOMAINS: ConsumptionDomain[] = [
  {
    id: "compute",
    short: "算",
    name: "推理与训练",
    thesis: "把电能和数据转化为智能行为，是硅基生命的肌肉与大脑。",
    demand: "GPU、AI 芯片、服务器、云与集群调度",
    themes: ["算力/AI芯片", "AI服务器", "云/AI基建"],
  },
  {
    id: "memory",
    short: "存",
    name: "记忆与权重",
    thesis: "保存模型权重、上下文和训练样本，让智能体能持续进化。",
    demand: "HBM、DRAM、NAND、存储控制与模组",
    themes: ["存储/HBM"],
  },
  {
    id: "optics",
    short: "光",
    name: "集群互连",
    thesis: "让算力节点彼此看见，决定大模型训练和推理集群的带宽上限。",
    demand: "光模块、光器件、高速互连",
    themes: ["光模块"],
  },
  {
    id: "power",
    short: "电",
    name: "能量与散热",
    thesis: "把电力稳定送入机柜，并把热量带走，维持硅基生命体征。",
    demand: "电力、功率半导体、液冷、IDC",
    themes: ["电力", "功率半导体", "液冷", "IDC"],
  },
  {
    id: "package",
    short: "封",
    name: "封装与制造",
    thesis: "把芯片、材料、晶圆和板级系统封成可规模交付的身体。",
    demand: "半导体设备、材料、晶圆代工、AI-PCB",
    themes: ["半导体设备", "半导体材料", "晶圆代工", "AI-PCB"],
  },
];

const DOMAIN_BY_THEME = new Map(
  CONSUMPTION_DOMAINS.flatMap((domain) =>
    domain.themes.map((theme) => [theme, domain] as const),
  ),
);

export function getConsumptionDomain(theme: string): ConsumptionDomain {
  return DOMAIN_BY_THEME.get(theme) ?? CONSUMPTION_DOMAINS[0];
}

export function getConsumptionDomainById(id: ConsumptionDomainId): ConsumptionDomain {
  return CONSUMPTION_DOMAINS.find((domain) => domain.id === id) ?? CONSUMPTION_DOMAINS[0];
}
