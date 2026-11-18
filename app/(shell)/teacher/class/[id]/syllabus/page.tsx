"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { SyllabusRoadmap } from "@/components/shared/SyllabusTable";
import { ClassMaterials } from "@/features/documents/class-materials";
import { SyllabusUnitMaterials } from "@/features/documents/syllabus-unit-materials";

export default function ClassSyllabusPage() {
  const params = useParams();
  const id = params.id as string;
  const [refresh, setRefresh] = React.useState({
    token: 0,
    source: "initial",
  });
  const handleDataChanged = React.useCallback((source: string) => {
    setRefresh((current) => ({ token: current.token + 1, source }));
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <SyllabusRoadmap classId={id} isTeacher refreshKey={refresh.token}>
        <SyllabusUnitMaterials
          classId={id}
          embedded
          refreshKey={refresh.token}
          changeSource={refresh.source}
          onChanged={handleDataChanged}
        />
        <ClassMaterials
          classId={id}
          refreshKey={refresh.token}
          changeSource={refresh.source}
          onDataChanged={handleDataChanged}
        />
      </SyllabusRoadmap>
    </div>
  );
}
