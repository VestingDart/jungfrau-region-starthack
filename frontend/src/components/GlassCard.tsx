import { HTMLMotionProps, motion } from "framer-motion";

export default function GlassCard({ className = "", ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border border-white/70 bg-white/65 shadow-soft backdrop-blur-xl ${className}`}
      {...props}
    />
  );
}
