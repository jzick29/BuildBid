export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 720 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Browser window frame */}
      <rect x="30" y="10" width="660" height="320" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
      <rect x="30" y="10" width="660" height="36" rx="12" fill="#f9fafb" />
      <rect x="30" y="34" width="660" height="12" fill="#f9fafb" />
      {/* Dots */}
      <circle cx="50" cy="28" r="5" fill="#ef4444" opacity="0.6" />
      <circle cx="68" cy="28" r="5" fill="#eab308" opacity="0.6" />
      <circle cx="86" cy="28" r="5" fill="#22c55e" opacity="0.6" />

      {/* Estimate list sidebar */}
      <rect x="42" y="54" width="180" height="264" rx="6" fill="#f5f3ff" />
      <text x="54" y="76" fontSize="12" fontWeight="600" fill="#4338ca" fontFamily="system-ui, sans-serif">Estimates</text>
      {[
        { name: "Kitchen Remodel", amount: "$24,500", status: "won" },
        { name: "Panel Upgrade", amount: "$8,200", status: "pending" },
        { name: "Bathroom Reno", amount: "$18,300", status: "won" },
        { name: "Deck Build", amount: "$15,750", status: "pending" },
      ].map((item, i) => (
        <g key={i}>
          <rect x="44" y={86 + i * 48} width="176" height="42" rx="6" fill={i === 0 ? "#e0e7ff" : "white"} stroke={i === 0 ? "#c7d2fe" : "#f3f4f6"} strokeWidth="1" />
          <text x="54" y={104 + i * 48} fontSize="11" fontWeight="600" fill="#1f2937" fontFamily="system-ui, sans-serif">{item.name}</text>
          <text x="54" y={120 + i * 48} fontSize="11" fill="#6b7280" fontFamily="system-ui, sans-serif">{item.amount}</text>
          <circle cx="194" cy={108 + i * 48} r="5" fill={item.status === "won" ? "#22c55e" : "#eab308"} />
        </g>
      ))}

      {/* Main content area - estimate detail */}
      <rect x="234" y="54" width="444" height="264" rx="6" fill="white" stroke="#f3f4f6" strokeWidth="1" />
      <text x="254" y="76" fontSize="14" fontWeight="700" fill="#1f2937" fontFamily="system-ui, sans-serif">Kitchen Remodel — Estimate #1042</text>

      {/* Line items table header */}
      <rect x="244" y="88" width="424" height="24" rx="4" fill="#f5f3ff" />
      <text x="254" y="104" fontSize="10" fontWeight="600" fill="#6366f1" fontFamily="system-ui, sans-serif">ITEM</text>
      <text x="420" y="104" fontSize="10" fontWeight="600" fill="#6366f1" fontFamily="system-ui, sans-serif">QTY</text>
      <text x="500" y="104" fontSize="10" fontWeight="600" fill="#6366f1" fontFamily="system-ui, sans-serif">RATE</text>
      <text x="590" y="104" fontSize="10" fontWeight="600" fill="#6366f1" fontFamily="system-ui, sans-serif">TOTAL</text>

      {/* Line items */}
      {[
        { item: "Cabinet installation (linear ft)", qty: "42", rate: "$85", total: "$3,570" },
        { item: "Countertop — quartz, fabricated", qty: "58", rate: "$72", total: "$4,176" },
        { item: "Tile backsplash installation", qty: "35", rate: "$48", total: "$1,680" },
        { item: "Under-cabinet LED lighting", qty: "16", rate: "$65", total: "$1,040" },
        { item: "Sink + faucet install", qty: "1", rate: "$420", total: "$420" },
      ].map((row, i) => (
        <g key={i}>
          <rect x="244" y={116 + i * 28} width="424" height="24" rx="3" fill={i % 2 === 0 ? "#fafafa" : "white"} />
          <text x="254" y={133 + i * 28} fontSize="10" fill="#374151" fontFamily="system-ui, sans-serif">{row.item}</text>
          <text x="432" y={133 + i * 28} fontSize="10" fill="#6b7280" fontFamily="system-ui, sans-serif" textAnchor="middle">{row.qty}</text>
          <text x="510" y={133 + i * 28} fontSize="10" fill="#6b7280" fontFamily="system-ui, sans-serif" textAnchor="middle">{row.rate}</text>
          <text x="610" y={133 + i * 28} fontSize="10" fontWeight="600" fill="#1f2937" fontFamily="system-ui, sans-serif" textAnchor="end">{row.total}</text>
        </g>
      ))}

      {/* Subtotals */}
      <line x1="500" y1="262" x2="662" y2="262" stroke="#e5e7eb" strokeWidth="1" />
      <text x="420" y="280" fontSize="11" fontWeight="600" fill="#1f2937" fontFamily="system-ui, sans-serif">Subtotal</text>
      <text x="610" y="280" fontSize="11" fontWeight="600" fill="#1f2937" fontFamily="system-ui, sans-serif" textAnchor="end">$10,886</text>
      <text x="420" y="300" fontSize="10" fill="#6b7280" fontFamily="system-ui, sans-serif">Margin</text>
      <text x="610" y="300" fontSize="10" fontWeight="600" fill="#16a34a" fontFamily="system-ui, sans-serif" textAnchor="end">+32%</text>
    </svg>
  );
}

export function FeatureIllustration({ name }: { name: string }) {
  const w = 200, h = 120;
  const font = "system-ui, -apple-system, sans-serif";
  switch (name) {
    case "assemblies":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="10" width="160" height="16" rx="3" fill="#c7d2fe" />
          <rect x="20" y="32" width="160" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="54" width="100" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="76" width="130" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="98" width="90" height="16" rx="3" fill="#e0e7ff" />
          <rect x="130" y="54" width="50" height="16" rx="3" fill="#a5b4fc" />
          <rect x="140" y="76" width="40" height="16" rx="3" fill="#a5b4fc" />
          <rect x="120" y="98" width="60" height="16" rx="3" fill="#a5b4fc" />
          <circle cx="170" cy="62" r="6" fill="#6366f1" />
          <circle cx="170" cy="84" r="6" fill="#6366f1" />
          <circle cx="170" cy="106" r="6" fill="#6366f1" />
        </svg>
      );
    case "proposals":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="5" width="140" height="110" rx="6" fill="white" stroke="#a5b4fc" strokeWidth="2" />
          <rect x="42" y="18" width="80" height="8" rx="2" fill="#c7d2fe" />
          <rect x="42" y="32" width="116" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="40" width="100" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="48" width="90" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="60" width="116" height="6" rx="2" fill="#c7d2fe" />
          <rect x="42" y="72" width="70" height="6" rx="2" fill="#c7d2fe" />
          <rect x="42" y="88" width="116" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="96" width="60" height="14" rx="3" fill="#6366f1" />
          <path d="M75 78 C80 78, 85 82, 90 88 L95 78" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "ai":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="25" width="140" height="70" rx="6" fill="white" stroke="#c7d2fe" strokeWidth="2" />
          <rect x="42" y="38" width="90" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="50" width="116" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="62" width="70" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="74" width="100" height="6" rx="2" fill="#e0e7ff" />
          <circle cx="80" cy="14" r="14" fill="#6366f1" opacity="0.15" />
          <text x="80" y="19" textAnchor="middle" fontSize="16" fontFamily={font}>✨</text>
          <line x1="80" y1="28" x2="80" y2="38" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3" opacity="0.4" />
        </svg>
      );
    case "takeoff":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="10" width="160" height="100" rx="4" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="2" />
          <rect x="35" y="25" width="50" height="35" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <rect x="100" y="25" width="55" height="20" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <rect x="35" y="70" width="80" height="20" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <line x1="85" y1="42" x2="100" y2="35" stroke="#6366f1" strokeWidth="1.5" />
          <text x="92" y="42" fontSize="8" fill="#6366f1" fontFamily={font}>{"12'-6\""}</text>
          <circle cx="50" cy="55" r="10" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="2 1" />
        </svg>
      );
    case "margin":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="40" height="80" rx="3" fill="#22c55e" opacity="0.25" />
          <text x="45" y="105" textAnchor="middle" fontSize="9" fill="#16a34a" fontFamily={font}>+32%</text>
          <rect x="80" y="35" width="40" height="60" rx="3" fill="#eab308" opacity="0.25" />
          <text x="100" y="105" textAnchor="middle" fontSize="9" fill="#ca8a04" fontFamily={font}>+18%</text>
          <rect x="135" y="55" width="40" height="40" rx="3" fill="#ef4444" opacity="0.25" />
          <text x="155" y="105" textAnchor="middle" fontSize="9" fill="#dc2626" fontFamily={font}>-5%</text>
          <line x1="15" y1="95" x2="185" y2="95" stroke="#d1d5db" strokeWidth="1" />
          <rect x="65" y="6" width="70" height="18" rx="5" fill="#6366f1" />
          <text x="100" y="18" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold" fontFamily={font}>Margin</text>
        </svg>
      );
    case "tracking":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="150" height="20" rx="4" fill="#c7d2fe" />
          <text x="35" y="29" fontSize="9" fill="#4338ca" fontFamily={font}>Kitchen remodel</text>
          <text x="135" y="29" fontSize="8" fill="#6366f1" fontFamily={font}>$24,500</text>
          <rect x="25" y="42" width="150" height="20" rx="4" fill="#e0e7ff" />
          <text x="35" y="56" fontSize="9" fill="#4338ca" fontFamily={font}>Panel upgrade</text>
          <text x="135" y="56" fontSize="8" fill="#6366f1" fontFamily={font}>$8,200</text>
          <rect x="25" y="69" width="150" height="20" rx="4" fill="#e0e7ff" />
          <text x="35" y="83" fontSize="9" fill="#4338ca" fontFamily={font}>AC install</text>
          <text x="135" y="83" fontSize="8" fill="#6366f1" fontFamily={font}>$12,750</text>
          <circle cx="100" cy="105" r="4" fill="#22c55e" />
          <text x="110" y="109" fontSize="8" fill="#16a34a" fontFamily={font}>3 won</text>
          <circle cx="150" cy="105" r="4" fill="#eab308" />
          <text x="159" y="109" fontSize="8" fill="#ca8a04" fontFamily={font}>1 pending</text>
        </svg>
      );
    default:
      return null;
  }
}
