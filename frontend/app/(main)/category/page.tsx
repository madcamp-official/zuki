import { Suspense } from "react";
import CategoryExplorer from "./CategoryExplorer";

export default function CategoryPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-heading text-3xl text-dark">카테고리 탐색</h1>
        <p className="mt-2 text-sm text-gray-500">
          디저트·음료·마케팅 트렌드를 카테고리별로 확인하세요
        </p>
      </div>

      <Suspense fallback={null}>
        <CategoryExplorer />
      </Suspense>
    </div>
  );
}
