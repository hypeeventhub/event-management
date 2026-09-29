"use client";

import { useEffect, useMemo, useRef } from "react";
import { createWheelSegmentsCache, formatWheelName, getWinnerRotation } from "../../lib/raffle-wheel.mjs";

const TAU = Math.PI * 2;
const NORMAL_SPIN_MS = 5600;
const REDUCED_SPIN_MS = 700;

function segmentLabel(attendee, count) {
  const name = formatWheelName(attendee);
  if (count <= 24) return name.length > 18 ? `${name.slice(0, 17)}…` : name;

  const [first = "", last = ""] = name.split(/\s+/);
  if (count <= 60) return `${first.slice(0, 9)} ${last ? `${last[0]}.` : ""}`.trim();
  return `${first[0] || "G"}.${last ? ` ${last[0]}.` : ""}`;
}

function drawWheel(canvas, segments, selectedRegistrationId) {
  const width = canvas.getBoundingClientRect().width || 560;
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const pixels = Math.round(width * ratio);
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }

  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, width);

  const middle = width / 2;
  const radius = middle - 8;
  if (segments.length === 0) {
    context.beginPath();
    context.arc(middle, middle, radius, 0, TAU);
    context.fillStyle = "#FFF4EE";
    context.fill();
    context.strokeStyle = "#F4C5AA";
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = "#9A4A23";
    context.font = `600 ${Math.max(16, width * 0.045)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("No eligible attendees", middle, middle, width * 0.78);
    return;
  }

  const step = TAU / segments.length;
  const selectedId = selectedRegistrationId == null ? null : String(selectedRegistrationId);
  segments.forEach((attendee, index) => {
    const start = -Math.PI / 2 + index * step;
    const center = start + step / 2;
    const isSelected = selectedId !== null && String(attendee.registration_id) === selectedId;

    context.beginPath();
    context.moveTo(middle, middle);
    context.arc(middle, middle, radius, start, start + step);
    context.closePath();
    context.fillStyle = isSelected ? "#F6671E" : index % 2 === 0 ? "#FFF4EE" : "#FFD7C1";
    context.fill();
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = segments.length > 80 ? 0.7 : 1.5;
    context.stroke();

    context.save();
    context.translate(middle, middle);
    context.rotate(center);
    context.fillStyle = isSelected ? "#FFFFFF" : "#733A21";
    context.font = `600 ${segments.length > 60 ? 9 : segments.length > 24 ? 11 : 13}px sans-serif`;
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillText(segmentLabel(attendee, segments.length), radius - 16, 0, radius * 0.6);
    context.restore();
  });

  context.beginPath();
  context.arc(middle, middle, Math.max(18, radius * 0.09), 0, TAU);
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#F6671E";
  context.stroke();
  context.beginPath();
  context.arc(middle, middle, Math.max(5, radius * 0.026), 0, TAU);
  context.fillStyle = "#F6671E";
  context.fill();
}

export function RaffleWheel({ attendees = [], selectedRegistrationId = null, spinning = false, onSpinEnd }) {
  const canvasRef = useRef(null);
  const wheelRef = useRef(null);
  const rotationRef = useRef(0);
  const activeSpinRef = useRef(false);
  const completedSpinRef = useRef(false);
  const onSpinEndRef = useRef(onSpinEnd);
  const selectedId = selectedRegistrationId == null ? null : String(selectedRegistrationId);
  const getSegments = useMemo(() => createWheelSegmentsCache(), []);
  const segments = useMemo(
    () => getSegments(attendees, selectedId),
    [attendees, selectedId, getSegments],
  );

  useEffect(() => {
    onSpinEndRef.current = onSpinEnd;
  }, [onSpinEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => drawWheel(canvas, segments, selectedId);
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [segments, selectedId]);

  useEffect(() => {
    if (!spinning) {
      activeSpinRef.current = false;
      completedSpinRef.current = false;
      return;
    }
    if (activeSpinRef.current || completedSpinRef.current || !wheelRef.current) return;

    const landing = getWinnerRotation(segments, selectedId);
    if (landing === 0) return;

    activeSpinRef.current = true;
    const wheel = wheelRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? REDUCED_SPIN_MS : NORMAL_SPIN_MS;
    const current = rotationRef.current;
    const offset = ((landing - current) % 360 + 360) % 360;
    const target = current + 6 * 360 + offset;
    rotationRef.current = target;
    wheel.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.12, 1)`;

    let finished = false;
    let timeout;
    const finish = () => {
      if (finished) return;
      finished = true;
      wheel.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(timeout);
      activeSpinRef.current = false;
      completedSpinRef.current = true;
      onSpinEndRef.current?.();
    };
    const handleTransitionEnd = (event) => {
      if (event.target === wheel && event.propertyName === "transform") finish();
    };
    wheel.addEventListener("transitionend", handleTransitionEnd);
    const frame = requestAnimationFrame(() => {
      wheel.style.transform = `rotate(${target}deg)`;
    });
    timeout = window.setTimeout(finish, duration + 100);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      wheel.removeEventListener("transitionend", handleTransitionEnd);
      activeSpinRef.current = false;
    };
  }, [segments, selectedId, spinning]);

  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none p-3" role="img" aria-label={
      segments.length === 0
        ? "Raffle wheel with no eligible attendees"
        : `Raffle wheel with ${attendees.length} eligible attendees`
    }>
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <div className="h-0 w-0 border-l-[17px] border-r-[17px] border-t-[34px] border-l-transparent border-r-transparent border-t-[#F6671E] drop-shadow-md" />
      </div>
      <div ref={wheelRef} className="rounded-full shadow-[0_12px_34px_rgba(142,70,29,0.18)]">
        <canvas ref={canvasRef} className="block aspect-square w-full rounded-full" />
      </div>
    </div>
  );
}

export default RaffleWheel;
