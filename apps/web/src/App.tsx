import { useCallback, useState } from "react";
import { builtinComponents } from "@motion-tool/components-builtin";
import { workEasyComponents } from "./data/workeasyComponents";
import { HomeRoute } from "./routes/HomeRoute";
import { EditorRoute } from "./routes/EditorRoute";
import { useProject } from "./state/useProject";
import { useImportFlow } from "./state/useImportFlow";
import type { MotionComponent } from "@motion-tool/core";

// 初始组件库：内置 + WorkEasy
const initialComponents: MotionComponent[] = [...builtinComponents, ...workEasyComponents];

type View = "home" | "editor";

export function App() {
  const [view, setView] = useState<View>("home");
  const [components, setComponents] = useState<MotionComponent[]>(initialComponents);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [restoreComponentId, setRestoreComponentId] = useState<string | null>(null);
  const { project, startProject, updateParam, replay, resetParams } = useProject();
  const importFlow = useImportFlow();

  function selectComponent(componentId: string) {
    const component = components.find((item) => item.id === componentId);
    if (!component) return;
    setSelectedComponentId(componentId);
    setRestoreComponentId(null);
    startProject(component.source, component.manifest);
    setView("editor");
  }

  function backToHome() {
    setRestoreComponentId(selectedComponentId);
    setView("home");
  }

  const clearRestoreComponentId = useCallback(() => {
    setRestoreComponentId(null);
  }, []);

  // 上传组件入库：追加到组件库 + 进入编辑
  function handleComponentAdded(component: MotionComponent) {
    setComponents((prev) => [...prev, component]);
    setSelectedComponentId(component.id);
    setRestoreComponentId(null);
    startProject(component.source, component.manifest);
    setView("editor");
  }

  if (view === "editor") {
    return (
      <EditorRoute
        project={project}
        onBack={backToHome}
        onParamChange={updateParam}
        onReplay={replay}
        onResetParams={resetParams}
      />
    );
  }

  return (
    <HomeRoute
      components={components}
      restoreComponentId={restoreComponentId}
      onSelectComponent={selectComponent}
      onRestoreComplete={clearRestoreComponentId}
      importFlow={importFlow}
      onComponentAdded={handleComponentAdded}
    />
  );
}