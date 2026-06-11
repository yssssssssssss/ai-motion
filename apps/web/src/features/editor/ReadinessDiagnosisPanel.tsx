import { analyzeGenerationReadiness, type MotionComponent } from "@motion-tool/core";

type Props = {
  component: MotionComponent | null;
};

function statusLabel(status: ReturnType<typeof analyzeGenerationReadiness>["status"]): string {
  if (status === "ready") return "生成就绪";
  if (status === "partial") return "部分可生成";
  return "需补规范";
}

function checkClass(status: string): string {
  if (status === "pass") return "good";
  if (status === "warn") return "warn";
  return "bad";
}

export function ReadinessDiagnosisPanel({ component }: Props) {
  if (!component) return null;
  const report = analyzeGenerationReadiness(component);
  const needsCompletion = report.status !== "ready";

  return (
    <section className="readiness-panel" aria-label="生成诊断">
      <div className="readiness-panel__header">
        <p className="eyebrow">生成诊断</p>
        <strong>{statusLabel(report.status)}</strong>
        <span>{report.score}</span>
      </div>
      <div className="readiness-checks">
        {report.checks.map((check) => (
          <p className={`readiness-check ${checkClass(check.status)}`} key={check.id}>
            <span>{check.label}</span>
            <small>{check.message}</small>
          </p>
        ))}
      </div>
      {needsCompletion ? (
        <div className="completion-actions" aria-label="补齐入口">
          <button type="button">补规范</button>
          <button type="button">声明图层</button>
          <button type="button">确认参数</button>
        </div>
      ) : null}
    </section>
  );
}
