import SpecsPanel     from "./SpecsPanel";
import BlueprintPanel from "./BlueprintPanel";
import BOQPanel       from "./BOQPanel";
import "./ResultsView.css";

export default function ResultsView({
  data, previewUrl, recalculating,
  wallLengthOverride, onWallLengthChange,
  cementBrand, wallThickness, planWidth, metalBrand, steelBrand,
  soilType, wastagePct, plinthHeight, labourDays, labourWorkers,
  wallHeight, numberOfFloors, floorArea, roofType, brickType, plasterType, paintType, floorFinish,
  onRecalculate, onReset, onShowScaleHelper, onShowCalibrator,
}) {
  const aiSummary = data?.ai_summary || {};
  const quotation = data?.quotation  || {};
  const isDXF     = (aiSummary.scale_source || "").toLowerCase().includes("dxf");
  const isV3      = (quotation.schema_version ?? 2) >= 3;

  return (
    <div className="rv-container">
      <div className="rv-top">
        <div className="rv-heading">
          <h1 className="rv-title">
            {isV3 ? "Construction Cost Estimate" : "Foundation Estimate"}
          </h1>
          <p className="rv-sub">
            {isV3 ? "Foundation + Superstructure" : "Strip footing model"}
            <span className="rv-sub-dot" />
            Materials + Labour
            <span className="rv-sub-dot" />
            CIDA 1:2:4
          </p>
        </div>
        <button className="rv-new-btn" onClick={onReset}>
          ↺ New Project
        </button>
      </div>

      <SpecsPanel
        cementBrand={cementBrand}
        wallThickness={wallThickness}
        metalBrand={metalBrand}
        steelBrand={steelBrand}
        planWidth={planWidth}
        soilType={soilType}
        wastagePct={wastagePct}
        plinthHeight={plinthHeight}
        labourDays={labourDays}
        labourWorkers={labourWorkers}
        wallHeight={wallHeight}
        numberOfFloors={numberOfFloors}
        floorArea={floorArea}
        roofType={roofType}
        brickType={brickType}
        plasterType={plasterType}
        paintType={paintType}
        floorFinish={floorFinish}
        isDXF={isDXF}
        onShowScaleHelper={onShowScaleHelper}
        onShowCalibrator={onShowCalibrator}
        onRecalculate={onRecalculate}
      />

      <div className="rv-grid">
        <BlueprintPanel
          aiSummary={aiSummary}
          previewUrl={previewUrl}
          wallLengthOverride={wallLengthOverride}
          onWallLengthChange={onWallLengthChange}
          onShowScaleHelper={onShowScaleHelper}
          onShowCalibrator={onShowCalibrator}
        />
        <BOQPanel quotation={quotation} aiSummary={aiSummary} recalculating={recalculating} />
      </div>
    </div>
  );
}
