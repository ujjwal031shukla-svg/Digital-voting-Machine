"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

const BREATHE_STYLES = `
@keyframes paths-breathe { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
.paths-breathe { animation: paths-breathe 6s ease-in-out infinite; }
@keyframes path-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -3200; } }
.path-flow { stroke-dasharray: 80 1600; animation: path-flow 13s linear infinite; }
`;

const FLOW_INDICES = [3, 9, 15, 21, 27, 33];

function FloatingPathsBase({ position }: { position: number }) {
    const paths = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
            380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
            152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
            684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        opacity: 0.1 + i * 0.03,
    })), [position]);

    return (
        <div className="absolute inset-0 pointer-events-none paths-breathe">
            <style dangerouslySetInnerHTML={{ __html: BREATHE_STYLES }} />
            <svg
                className="w-full h-full text-slate-950 dark:text-white"
                viewBox="0 0 696 316"
                fill="none"
            >
                <title>Background Paths</title>
                {paths.map((path) => (
                    <path
                        key={path.id}
                        d={path.d}
                        stroke="currentColor"
                        strokeWidth={path.width}
                        strokeOpacity={path.opacity}
                    />
                ))}
                {FLOW_INDICES.map((idx, i) => (
                    <path
                        key={`flow-${idx}`}
                        className="path-flow"
                        d={paths[idx].d}
                        stroke="currentColor"
                        strokeWidth={paths[idx].width + 0.6}
                        strokeOpacity={0.9}
                        style={{ animationDuration: `${11 + i * 2}s`, animationDelay: `${i * -2.5}s` }}
                    />
                ))}
            </svg>
        </div>
    );
}

const FloatingPaths = React.memo(FloatingPathsBase);

export interface BackgroundPathsProps {
    title?: string;
    onStartVoting?: () => void;
    onOfficerSignIn?: () => void;
}

export function BackgroundPaths({
    title = "One Person One Ballot",
    onStartVoting,
    onOfficerSignIn,
}: BackgroundPathsProps) {
    const words = title.split(" ");

    const handleStartVoting = onStartVoting ?? (() => document.getElementById('ballot-console')?.scrollIntoView({ behavior: 'smooth' }));
    const handleOfficerSignIn = onOfficerSignIn ?? (() => document.getElementById('ballot-console')?.scrollIntoView({ behavior: 'smooth' }));

    return (
        <div className="relative min-h-[88vh] w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
            <div className="absolute inset-0">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.1 }}
                    className="max-w-4xl mx-auto"
                >
                    <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter">
                        {words.map((word, wordIndex) => (
                            <span
                                key={wordIndex}
                                className="inline-block mr-4 last:mr-0"
                            >
                                {word.split("").map((letter, letterIndex) => (
                                    <motion.span
                                        key={`${wordIndex}-${letterIndex}`}
                                        initial={{ y: 100, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{
                                            delay:
                                                wordIndex * 0.1 +
                                                letterIndex * 0.03,
                                            type: "spring",
                                            stiffness: 150,
                                            damping: 25,
                                        }}
                                        className="inline-block text-transparent bg-clip-text 
                                        bg-gradient-to-r from-neutral-900 to-neutral-700/80 
                                        dark:from-white dark:to-white/80"
                                    >
                                        {letter}
                                    </motion.span>
                                ))}
                            </span>
                        ))}
                    </h1>

                    <div
                        className="inline-block group relative bg-gradient-to-b from-black/10 to-white/10 
                        dark:from-white/10 dark:to-black/10 p-px rounded-2xl backdrop-blur-lg 
                        overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                        <div className="flex flex-col sm:flex-row gap-2 rounded-[1.15rem] p-2 bg-white/95 dark:bg-black/95 backdrop-blur-md">
                            <Button
                                variant="ghost"
                                onClick={handleStartVoting}
                                className="rounded-[0.9rem] px-8 py-6 text-lg font-semibold 
                                text-black dark:text-white transition-all duration-300 
                                group-hover:-translate-y-0.5 border border-black/10 dark:border-white/10
                                hover:shadow-md dark:hover:shadow-neutral-800/50"
                            >
                                <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                                    START VOTING
                                </span>
                                <span
                                    className="ml-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5 
                                    transition-all duration-300"
                                >
                                    →
                                </span>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleOfficerSignIn}
                                className="rounded-[0.9rem] px-8 py-6 text-lg font-semibold 
                                text-black dark:text-white transition-all duration-300 
                                group-hover:-translate-y-0.5 border border-black/10 dark:border-white/10
                                hover:shadow-md dark:hover:shadow-neutral-800/50 bg-black/5 dark:bg-white/10"
                            >
                                <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                                    OFFICER SIGN-IN
                                </span>
                                <span
                                    className="ml-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5 
                                    transition-all duration-300"
                                >
                                    →
                                </span>
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
