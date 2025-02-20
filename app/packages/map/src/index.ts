import { registerComponent, PluginComponentType } from "@fiftyone/plugins";
import { BUILT_IN_PANEL_PRIORITY_CONST, Schema } from "@fiftyone/utilities";
import Map from "./Map";
import MapIcon from "@mui/icons-material/Map";
import MapTabIndicator from "./MapTabIndicator";

export { default as Map } from "./Map";

registerComponent({
  name: "Map",
  label: "Map",
  component: Map,
  type: PluginComponentType.Panel,
  activator: hasGeoField,
  Icon: MapIcon,
  panelOptions: {
    TabIndicator: MapTabIndicator,
    priority: BUILT_IN_PANEL_PRIORITY_CONST,
  },
});

function hasGeoField({ schema }: { schema: Schema }) {
  for (const name in schema) {
    if (schema[name].embeddedDocType === "fiftyone.core.labels.GeoLocation") {
      return true;
    }
  }
  return false;
}
