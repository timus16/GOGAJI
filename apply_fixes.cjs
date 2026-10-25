const fs = require("fs");

let content = fs.readFileSync("src/components/Generator.tsx", "utf8");

// 1. Add GeneratorProps interface and update function signature
content = content.replace(
  "export default function Generator() {",
  `interface GeneratorProps {
  initialName?: string;
  subject?: "self" | "child";
  autoGenerate?: boolean;
}

export default function Generator({ initialName = "", subject = "self", autoGenerate = false }: GeneratorProps) {`
);

// 2. Use initialName in useState for name
content = content.replace(
  "const [name, setName] = useState(\"\");",
  "const [name, setName] = useState(initialName);"
);

// 3. Fix character encoding: replace replacement char with middle dot
content = content.replace(/\uFFFD/g, "\u00B7");

// 4. Fix download button multiplication sign
content = content.replace(
  "`Download phone PNG ${PHONE.width}\u00B7${PHONE.height}`",
  "`Download phone PNG ${PHONE.width}\u00D7${PHONE.height}`"
);
content = content.replace(
  "`Download desktop PNG ${DESKTOP.width}\u00B7${DESKTOP.height}`",
  "`Download desktop PNG ${DESKTOP.width}\u00D7${DESKTOP.height}`"
);

// 5. Set default place label to "New Delhi"
content = content.replace(
  "const [place, setPlace] = useState({ label: \"\", latitude: 28.6139, longitude: 77.209, timezone: \"Asia/Kolkata\" });",
  "const [place, setPlace] = useState({ label: \"New Delhi\", latitude: 28.6139, longitude: 77.209, timezone: \"Asia/Kolkata\" });"
);

// 6. Add IDs to focus area checkboxes
content = content.replace(
  "<input type=\"checkbox\" checked={focusAreas.includes(area)} onChange={() => toggleArea(area)}",
  "<input type=\"checkbox\" id={\"focus-\" + area} checked={focusAreas.includes(area)} onChange={() => toggleArea(area)}"
);

// 7. Add live chart computation useEffect
const liveChartEffect = `
  // Live chart computation: update the chart as the user fills the form
  // so the preview appears immediately without waiting for submit.
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const yearNum = Number(yearText);
    const dayNum = Number(dayText);
    const daysInMonth = dim(yearNum, month);
    const yearOk = yearNum >= 1900 && yearNum <= currentYear;
    const dayOk = dayNum >= 1 && dayNum <= daysInMonth;
    const hour24 = (hour12 % 12) + (ampm === "PM" ? 12 : 0);
    const ss = seconds.replace(/[^0-9]/g, "");
    const composedDate = yearOk && dayOk ? \`\${yearNum}-\${pad2(month)}-\${pad2(dayNum)}\` : "";
    const composedTime = ss === "" ? \`\${pad2(hour24)}:\${pad2(minute)}\` : \`\${pad2(hour24)}:\${pad2(minute)}:\${ss.padStart(2, "0")}\`;

    if (name.trim() && composedDate && composedTime && place.label) {
      const input: BirthInput = {
        name,
        date: composedDate,
        time: composedTime,
        place: place.label || \`\${place.latitude.toFixed(3)}, \${place.longitude.toFixed(3)}\`,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
      };
      try {
        const next = computeChart(input);
        buildWallpaperSvg({ chart: next, presetId: preset, width: PHONE.width, height: PHONE.height, fontFaceCss: previewFontFaceCss });
        setChart(next);
      } catch {
        setChart(null);
      }
    } else {
      setChart(null);
    }
  }, [name, month, dayText, yearText, hour12, minute, ampm, seconds, place, preset]);`;

content = content.replace(
  "useEffect(() => { setAiKeys(readSavedKeys()); }, []);\n  const previewRef = useRef<HTMLDivElement | null>(null);",
  "useEffect(() => { setAiKeys(readSavedKeys()); }, []);" + liveChartEffect + "\n  const previewRef = useRef<HTMLDivElement | null>(null);"
);

fs.writeFileSync("src/components/Generator.tsx", content);
console.log("All fixes applied");
