# 硅基生命消费链研究页

这是一个面向中国 A 股的公开研究页和本地研究工具。核心假设是：AI 算力体如果被看作一种持续工作、协同和扩张的硅基生命，它自身会持续“消费”一组底层资源，而这些资源可以映射到 A 股供应链。

公开页地址：<https://herbert-zhangzhicheng.github.io/silicon-civilization-stock-trade/>

## 研究框架

页面把硅基生命的工作循环拆成六个领域：

- `存`：保存权重、上下文、缓存和训练状态，对应 `存储/HBM`。
- `算`：把数据和电能转化为智能行动，对应 `算力/AI芯片`、`云/AI基建`。
- `光`：让节点之间交换激活值和参数，对应 `光模块`。
- `电`：维持机柜供电、稳压、备电和排热，对应 `功率半导体`、`MLCC/被动元件`、`AIDC供配电`、`备用电源/燃机`、`液冷`、`IDC`。
- `封`：把裸片、HBM、封装基板、AI-PCB 和整机集成成可部署的系统身体，对应 `先进封装`、`AI-PCB`、`AI服务器`。
- `造`：把设计批量复制成更多芯片身体，对应 `半导体设备`、`半导体材料`、`晶圆代工`。

股票池坚持 A 股口径，不包含港股、美股、ST、暂停上市标的或纯人类消费品。每个标的都带有 `global_supply` 字段，用于标注是否进入全球 AI 供应链。

## 项目结构

- `docs/`：GitHub Pages 静态研究页。
- `web/`：Next.js 本地研究工具，包含股票池、筛选表、信号页和回测页。
- `pyserver/`：FastAPI sidecar，用于 Tushare/AkShare 行情、基本面和分析师数据。

## 本地运行

启动 Python sidecar：

```bash
cd pyserver
cp env.example .env
# 在 .env 中配置 TUSHARE_TOKEN
uv sync
uv run uvicorn main:app --port 8001 --reload
```

启动 Web 应用：

```bash
cd web
npm install
cp env.example.txt .env.local
# 在 .env.local 中配置 DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL、PYSERVER_URL
npm run dev
```

打开 <http://localhost:3000>。

## 刷新静态页

静态页发布自 `docs/`。如果只刷新研究页和股票池，可以跳过较慢的信号与回测：

```bash
cd web
SNAPSHOT_SKIP_SIGNALS=1 SNAPSHOT_SKIP_BACKTEST=1 npx tsx scripts/snapshot.ts
```

本地预览：

```bash
python3 -m http.server 8765 --directory docs
```

## 校验

```bash
cd web
./node_modules/.bin/tsc --noEmit
npm test
```

本项目仅用于公开研究和数据整理，不构成投资建议。
