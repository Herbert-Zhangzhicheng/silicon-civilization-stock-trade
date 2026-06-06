export type ConsumptionDomainId = "compute" | "memory" | "optics" | "power" | "package" | "manufacture";

export interface ConsumptionDomain {
  id: ConsumptionDomainId;
  short: string;
  name: string;
  verb: string;
  thesis: string;
  work: string;
  consumes: string;
  demand: string;
  bottleneck: string;
  themes: string[];
}

export interface LifeWorkStage {
  step: string;
  domainId: ConsumptionDomainId;
  title: string;
  description: string;
}

export const CONSUMPTION_DOMAINS: ConsumptionDomain[] = [
  {
    id: "compute",
    short: "算",
    name: "计算器官",
    verb: "思考与行动",
    thesis: "把电能和数据转化为智能行为，是硅基生命的执行器官。",
    work: "训练模型、生成 token、运行代理、调度集群任务",
    consumes: "AI 芯片、云与算力调度平台",
    demand: "GPU、AI 芯片、云与集群调度",
    bottleneck: "单位功耗吞吐、国产算力可用性、软件生态与调度效率",
    themes: ["算力/AI芯片", "云/AI基建"],
  },
  {
    id: "memory",
    short: "存",
    name: "记忆器官",
    verb: "保存与回忆",
    thesis: "保存权重、上下文、样本和状态，让智能体能持续进化。",
    work: "承载模型权重、KV cache、训练数据、检查点和长期记忆",
    consumes: "HBM、DRAM、NAND、存储控制、封测与模组",
    demand: "HBM、DRAM、NAND、存储控制与模组",
    bottleneck: "带宽、容量、先进封装协同和全球存储大厂扩产节奏",
    themes: ["存储/HBM"],
  },
  {
    id: "optics",
    short: "光",
    name: "神经互连",
    verb: "沟通与同步",
    thesis: "让算力节点彼此看见，决定训练和推理集群的带宽上限。",
    work: "在 GPU、交换机、机柜和数据中心之间搬运激活值与参数",
    consumes: "光模块、光芯片、光器件、薄膜铌酸锂和高速互连",
    demand: "光模块、光器件、高速互连",
    bottleneck: "光进铜退、800G/1.6T 放量、硅光/CPO 演进",
    themes: ["光模块"],
  },
  {
    id: "power",
    short: "电",
    name: "能量代谢",
    verb: "供能与排热",
    thesis: "把外部电能变成机柜可用、可稳压、可备份、可散热的连续生命体征。",
    work: "变压配电、稳压滤波、功率变换、备用发电、燃机自备电源和高功率散热",
    consumes: "变压器、UPS/HVDC、MLCC/电感/电阻、功率半导体、柴发、燃机、IDC 和液冷系统",
    demand: "功率半导体、MLCC/被动元件、AIDC供配电、备用电源/燃机、液冷、IDC",
    bottleneck: "电网接入周期、变压器交期、机柜供电密度、备用电源可靠性、800V/高压直流架构和液冷渗透率",
    themes: ["功率半导体", "MLCC/被动元件", "AIDC供配电", "备用电源/燃机", "液冷", "IDC"],
  },
  {
    id: "package",
    short: "封",
    name: "封装成体",
    verb: "封成身体",
    thesis: "把裸片、HBM、封装基板、高阶 PCB 和 AI 服务器整机封成可上架、可扩张的系统身体。",
    work: "连接 GPU/ASIC、HBM、interposer、封装基板、高阶 PCB/CCL，并完成服务器整机集成",
    consumes: "2.5D/3D、Fan-out、Bumping、WLCSP、SiP、AI-PCB/CCL、整机代工与系统集成产能",
    demand: "先进封装、封测、晶圆级封装、AI-PCB、高速 CCL、AI服务器",
    bottleneck: "CoWoS/2.5D 产能、良率、HBM 协同、高阶 PCB 材料认证和整机交付节奏",
    themes: ["先进封装", "AI-PCB", "AI服务器"],
  },
  {
    id: "manufacture",
    short: "造",
    name: "制造底座",
    verb: "复制身体",
    thesis: "把设计变成可量产的晶圆、设备和材料供给，是硅基生命扩张的工厂。",
    work: "制造晶圆、提供制程设备和关键材料，把计算器官从设计变成批量芯片",
    consumes: "晶圆代工、半导体设备、半导体材料",
    demand: "晶圆代工、制程设备、靶材、CMP、光刻胶、硅片与电子特气",
    bottleneck: "先进制程产能、设备国产化、材料认证和晶圆厂资本开支",
    themes: ["半导体设备", "半导体材料", "晶圆代工"],
  },
];

export const LIFE_WORKFLOW: LifeWorkStage[] = [
  {
    step: "01",
    domainId: "memory",
    title: "先保存状态",
    description: "权重、样本、上下文和缓存构成记忆；没有存储带宽，智能体无法保持连续性。",
  },
  {
    step: "02",
    domainId: "compute",
    title: "再进行思考",
    description: "算力把记忆转化为训练、推理和行动，决定硅基生命单位时间能完成多少工作。",
  },
  {
    step: "03",
    domainId: "optics",
    title: "然后集群协同",
    description: "大模型不是单颗芯片在工作，而是大规模节点同步；光互连就是神经束。",
  },
  {
    step: "04",
    domainId: "power",
    title: "持续供能排热",
    description: "智能越强，代谢越高；变压配电、功率器件、MLCC、备用电源、IDC 和液冷决定生命体征是否稳定。",
  },
  {
    step: "05",
    domainId: "package",
    title: "封成系统身体",
    description: "先进封装、高阶 PCB 和服务器整机集成，把计算裸片、HBM 与板级高速通道封成可部署的系统身体。",
  },
  {
    step: "06",
    domainId: "manufacture",
    title: "复制更多身体",
    description: "晶圆代工、设备和材料把设计持续量产，让硅基生命从样机变成种群。",
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
