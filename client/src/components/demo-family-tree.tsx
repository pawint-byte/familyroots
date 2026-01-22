interface DemoMember {
  id: string;
  name: string;
  initials: string;
  isUnknown?: boolean;
}

interface NodePosition {
  x: number;
  y: number;
  member: DemoMember;
}

const DEMO_MEMBERS: DemoMember[] = [
  { id: "gf", name: "Grandpa", initials: "GP" },
  { id: "gm", name: "Grandma", initials: "GM" },
  { id: "dad", name: "Dad", initials: "D" },
  { id: "mom", name: "Mom", initials: "M" },
  { id: "uncle", name: "Uncle", initials: "U" },
  { id: "aunt", name: "Aunt", initials: "A", isUnknown: true },
  { id: "you", name: "You", initials: "Y" },
  { id: "sibling", name: "Brother", initials: "B" },
  { id: "cousin", name: "Cousin", initials: "C" },
  { id: "child1", name: "Son", initials: "S" },
  { id: "child2", name: "Daughter", initials: "D" },
];

const SVG_WIDTH = 520;
const SVG_HEIGHT = 380;
const NODE_RADIUS = 20;
const ROW_HEIGHT = 88;

export function DemoFamilyTree() {
  const positions: NodePosition[] = [
    // Generation 0: Grandparents (centered)
    { x: 210, y: 35, member: DEMO_MEMBERS[0] },
    { x: 310, y: 35, member: DEMO_MEMBERS[1] },
    // Generation 1: Parents & Uncle/Aunt (spread wider)
    { x: 130, y: 35 + ROW_HEIGHT, member: DEMO_MEMBERS[2] },
    { x: 210, y: 35 + ROW_HEIGHT, member: DEMO_MEMBERS[3] },
    { x: 350, y: 35 + ROW_HEIGHT, member: DEMO_MEMBERS[4] },
    { x: 430, y: 35 + ROW_HEIGHT, member: DEMO_MEMBERS[5] },
    // Generation 2: You, Sibling, Cousin
    { x: 110, y: 35 + 2 * ROW_HEIGHT, member: DEMO_MEMBERS[6] },
    { x: 190, y: 35 + 2 * ROW_HEIGHT, member: DEMO_MEMBERS[7] },
    { x: 390, y: 35 + 2 * ROW_HEIGHT, member: DEMO_MEMBERS[8] },
    // Generation 3: Children
    { x: 90, y: 35 + 3 * ROW_HEIGHT, member: DEMO_MEMBERS[9] },
    { x: 170, y: 35 + 3 * ROW_HEIGHT, member: DEMO_MEMBERS[10] },
  ];

  const connections = [
    // Grandparents to parents
    { from: "gf", to: "dad" }, { from: "gm", to: "dad" },
    { from: "gf", to: "uncle" }, { from: "gm", to: "uncle" },
    // Parents to children
    { from: "dad", to: "you" }, { from: "mom", to: "you" },
    { from: "dad", to: "sibling" }, { from: "mom", to: "sibling" },
    { from: "uncle", to: "cousin" }, { from: "aunt", to: "cousin" },
    // You to grandkids
    { from: "you", to: "child1" }, { from: "you", to: "child2" },
  ];

  const spouseConnections = [
    { from: "gf", to: "gm" },
    { from: "dad", to: "mom" },
    { from: "uncle", to: "aunt" },
  ];

  const getPos = (id: string) => positions.find(p => p.member.id === id);

  return (
    <div className="w-full min-w-0" data-testid="demo-family-tree">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto max-w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Sample family tree showing 4 generations"
        data-testid="svg-demo-tree"
      >
        {/* Parent-child connections */}
        <g data-testid="demo-connections-parent-child">
          {connections.map((conn, i) => {
            const from = getPos(conn.from);
            const to = getPos(conn.to);
            if (!from || !to) return null;
            const midY = (from.y + to.y) / 2;
            return (
              <path
                key={`conn-${i}`}
                d={`M ${from.x} ${from.y + NODE_RADIUS} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - NODE_RADIUS}`}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeOpacity="0.4"
                fill="none"
              />
            );
          })}
        </g>

        {/* Spouse connections */}
        <g data-testid="demo-connections-spouse">
          {spouseConnections.map((conn, i) => {
            const from = getPos(conn.from);
            const to = getPos(conn.to);
            if (!from || !to) return null;
            return (
              <g key={`spouse-${i}`}>
                <line
                  x1={from.x + NODE_RADIUS}
                  y1={from.y}
                  x2={to.x - NODE_RADIUS}
                  y2={to.y}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeOpacity="0.4"
                />
                <circle
                  cx={(from.x + to.x) / 2}
                  cy={from.y}
                  r="4"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity="0.5"
                />
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        {positions.map((pos) => {
          const isYou = pos.member.id === "you";
          const isUnknown = pos.member.isUnknown;

          return (
            <g key={pos.member.id} data-testid={`demo-node-${pos.member.id}`}>
              {/* Node background */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_RADIUS}
                fill={isUnknown ? "hsl(var(--muted))" : isYou ? "hsl(var(--primary))" : "hsl(var(--card))"}
                stroke={isUnknown ? "hsl(var(--muted-foreground))" : isYou ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isUnknown ? "2" : "2"}
                strokeDasharray={isUnknown ? "4 2" : "none"}
                fillOpacity={isUnknown ? "0.5" : "1"}
              />
              
              {/* Ring for "You" */}
              {isYou && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_RADIUS + 4}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeOpacity="0.4"
                />
              )}

              {/* Initials or ? for unknown */}
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="600"
                fill={isUnknown ? "hsl(var(--muted-foreground))" : isYou ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"}
                data-testid={`demo-node-initials-${pos.member.id}`}
              >
                {isUnknown ? "?" : pos.member.initials}
              </text>

              {/* Name label below */}
              <text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 12}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill={isUnknown ? "hsl(var(--muted-foreground))" : isYou ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                fontStyle={isUnknown ? "italic" : "normal"}
                data-testid={`demo-node-name-${pos.member.id}`}
              >
                {pos.member.name}
              </text>
            </g>
          );
        })}

        {/* Generation labels */}
        <g data-testid="demo-generation-labels">
          <text x="12" y="38" fontSize="8" fill="hsl(var(--muted-foreground))" data-testid="label-gen-grandparents">Grandparents</text>
          <text x="12" y={38 + ROW_HEIGHT} fontSize="8" fill="hsl(var(--muted-foreground))" data-testid="label-gen-parents">Parents</text>
          <text x="12" y={38 + 2 * ROW_HEIGHT} fontSize="8" fill="hsl(var(--muted-foreground))" data-testid="label-gen-you">You</text>
          <text x="12" y={38 + 3 * ROW_HEIGHT} fontSize="8" fill="hsl(var(--muted-foreground))" data-testid="label-gen-children">Children</text>
        </g>
      </svg>
    </div>
  );
}
