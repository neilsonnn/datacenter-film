import { DatacenterFilmApp } from "./DatacenterFilmApp";
import { WorldBuilderApp } from "./WorldBuilderApp";
import { useAppModeStore } from "./appModeStore";
import { Lightbox } from "./components/Lightbox";
import { TopBar } from "./components/TopBar";

export default function App() {
  const mode = useAppModeStore((s) => s.mode);

  return (
    <>
      <TopBar />
      <Lightbox />
      {mode === "datacenter-film" ? <DatacenterFilmApp /> : <WorldBuilderApp />}
    </>
  );
}
