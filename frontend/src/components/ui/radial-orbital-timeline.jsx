"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export default function RadialOrbitalTimeline({
  timelineData,
}) {
  const [expandedItems, setExpandedItems] = useState({});
  const [viewMode, setViewMode] = useState("orbital");
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState({});
  const [centerOffset, setCenterOffset] = useState({
    x: 0,
    y: 0,
  });
  const [activeNodeId, setActiveNodeId] = useState(null);
  const containerRef = useRef(null);
  const orbitRef = useRef(null);
  const nodeRefs = useRef({});

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer;

    if (autoRotate && viewMode === "orbital") {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }

    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate, viewMode]);

  const centerViewOnNode = (nodeId) => {
    if (viewMode !== "orbital" || !nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index, total) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 220;
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId) => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId) => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "completed":
        return "text-white bg-emerald-500 border-emerald-400";
      case "in-progress":
        return "text-white bg-blue-500 border-blue-400";
      case "pending":
        return "text-white bg-gray-500/40 border-white/50";
      default:
        return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      className="w-full h-[600px] flex flex-col items-center justify-center bg-app-surface rounded-3xl overflow-hidden relative border border-app-border shadow-inner transition-colors duration-300"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.1]" style={{
        backgroundImage: `radial-gradient(var(--border-color) 1px, transparent 1px)`,
        backgroundSize: '32px 32px'
      }} />

      <div className="relative w-full max-w-4xl h-full flex items-center justify-center scale-90 md:scale-100">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          {/* Central Sun/Hub */}
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 animate-pulse flex items-center justify-center z-10 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <div className="absolute w-24 h-24 rounded-full border border-emerald-500/30 animate-ping opacity-70"></div>
            <div
              className="absolute w-32 h-32 rounded-full border border-emerald-500/20 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            ></div>
            <div className="w-10 h-10 rounded-full bg-app-surface flex items-center justify-center shadow-lg">
              <Zap size={20} className="text-app-emerald" />
            </div>
          </div>

          {/* Main Orbit Ring */}
          <div className="absolute w-[440px] h-[440px] rounded-full border border-app-border shadow-[inset_0_0_30px_rgba(0,0,0,0.03)]"></div>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            const nodeStyle = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute transition-all duration-700 cursor-pointer"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                {/* Glow behind node */}
                <div
                  className={`absolute rounded-full -inset-4 ${
                    isPulsing ? "animate-pulse duration-1000" : ""
                  } transition-all duration-500`}
                  style={{
                    background: `radial-gradient(circle, ${isExpanded ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.05)'} 0%, rgba(0,0,0,0) 70%)`,
                  }}
                ></div>

                {/* Node Circle */}
                <div
                  className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${
                    isExpanded
                      ? "bg-app-emerald text-white"
                      : isRelated
                      ? "bg-app-emerald/10 text-app-emerald"
                      : "bg-app-muted text-app-text-muted"
                  }
                  border-2 
                  ${
                    isExpanded
                      ? "border-app-emerald shadow-xl shadow-app-emerald/30"
                      : isRelated
                      ? "border-app-emerald/40 animate-pulse"
                      : "border-app-border"
                  }
                  transition-all duration-500 transform
                  ${isExpanded ? "scale-125" : "hover:scale-110 hover:border-emerald-400 hover:text-emerald-600"}
                  shadow-md
                `}
                >
                  <Icon size={20} />
                </div>

                {/* Node Label */}
                <div
                  className={`
                  absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap
                  text-[10px] font-extrabold uppercase tracking-[0.2em]
                  transition-all duration-500
                  ${isExpanded ? "text-app-text opacity-100 translate-y-1" : "text-app-text-muted opacity-80"}
                `}
                >
                  {item.title}
                </div>

                {/* Detail Card */}
                {isExpanded && (
                  <Card className="absolute top-20 left-1/2 -translate-x-1/2 w-72 bg-app-surface backdrop-blur-xl border-app-border shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-visible animate-in fade-in zoom-in duration-300">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-app-emerald"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-serif text-app-text font-bold">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-app-text-muted leading-relaxed font-medium">
                      <p>{item.content}</p>

                      {item.relatedIds.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-app-border">
                          <div className="flex items-center mb-3">
                            <Link size={10} className="text-app-emerald mr-2" />
                            <h4 className="text-[10px] uppercase tracking-[0.15em] font-black text-app-text-muted/50">
                              Integrated Workflows
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find(
                                (i) => i.id === relatedId
                              );
                              return (
                                <Button
                                  key={relatedId}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center h-7 px-3 py-0 text-[10px] rounded-full border-app-border bg-app-muted hover:bg-app-emerald hover:border-app-emerald text-app-text hover:text-white transition-all duration-300 shadow-sm font-bold"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(relatedId);
                                  }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight
                                    size={10}
                                    className="ml-1 opacity-50"
                                  />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
