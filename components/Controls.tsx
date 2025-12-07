import React from 'react';
import { FormationType } from '../types';
import { Play, RotateCcw, BrainCircuit } from 'lucide-react';

interface ControlsProps {
  onStart: () => void;
  onReset: () => void;
  onAnalyze: () => void;
  unitCount: number;
  setUnitCount: (n: number) => void;
  macedoniaFormation: FormationType;
  setMacedoniaFormation: (f: FormationType) => void;
  easternFormation: FormationType;
  setEasternFormation: (f: FormationType) => void;
  isRunning: boolean;
  isAnalyzing: boolean;
  advisorText: string;
}

export const Controls: React.FC<ControlsProps> = ({
  onStart, onReset, onAnalyze, unitCount, setUnitCount,
  macedoniaFormation, setMacedoniaFormation,
  easternFormation, setEasternFormation,
  isRunning, isAnalyzing, advisorText
}) => {
  return (
    <div className="absolute top-4 left-4 w-80 p-6 rounded-xl bg-stone-950/80 backdrop-blur-md border border-stone-800 shadow-2xl z-10 text-stone-200 pointer-events-auto select-none">
      <h1 className="text-2xl font-bold cinzel text-amber-500 mb-4 border-b border-stone-700 pb-2">
        Command Deck
      </h1>

      {/* Army Size Slider */}
      <div className="mb-6">
        <label className="text-xs uppercase tracking-widest text-stone-500 font-bold mb-2 block">
          Army Scale ({unitCount * 2} units)
        </label>
        <input
          type="range"
          min="50"
          max="400"
          step="10"
          value={unitCount}
          onChange={(e) => setUnitCount(parseInt(e.target.value))}
          className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-600 hover:accent-amber-500"
          disabled={isRunning}
        />
      </div>

      {/* Formations */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs uppercase tracking-widest text-red-400 font-bold mb-1 block">Macedonia</label>
          <select 
            value={macedoniaFormation}
            onChange={(e) => setMacedoniaFormation(e.target.value as FormationType)}
            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-sm focus:border-red-500 outline-none transition-colors"
          >
            <option value={FormationType.PHALANX}>Syntagma (Phalanx)</option>
            <option value={FormationType.FLANKING}>Hammer & Anvil</option>
            <option value={FormationType.LINE}>Standard Line</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-purple-400 font-bold mb-1 block">Eastern Empire</label>
          <select 
            value={easternFormation}
            onChange={(e) => setEasternFormation(e.target.value as FormationType)}
            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-sm focus:border-purple-500 outline-none transition-colors"
          >
            <option value={FormationType.LINE}>Imperial Line</option>
            <option value={FormationType.WEDGE}>Beast Wall (Elephants)</option>
            <option value={FormationType.SCATTERED}>Skirmish Cloud</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {!isRunning ? (
          <button 
            onClick={onStart}
            className="flex-1 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold py-3 px-4 rounded shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 cinzel"
          >
            <Play size={18} /> BATTLE
          </button>
        ) : (
          <button 
            onClick={onReset}
            className="flex-1 bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 px-4 rounded shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 cinzel border border-stone-600"
          >
            <RotateCcw size={18} /> RESET
          </button>
        )}
      </div>

      {/* AI Advisor */}
      <div className="border-t border-stone-800 pt-4">
        <div className="flex justify-between items-center mb-2">
           <label className="text-xs uppercase tracking-widest text-emerald-500 font-bold flex items-center gap-1">
             <BrainCircuit size={14} /> Tactical Advisor
           </label>
           {isRunning && (
             <button 
               onClick={onAnalyze} 
               disabled={isAnalyzing}
               className={`text-xs px-3 py-1 rounded transition-colors disabled:opacity-50 font-bold border flex items-center gap-2 ${isAnalyzing ? 'bg-emerald-900/50 border-emerald-700 text-emerald-200 cursor-not-allowed' : 'bg-emerald-900/30 border-emerald-800 text-emerald-400 hover:bg-emerald-900 hover:text-emerald-300'}`}
             >
               {isAnalyzing ? (
                 <>
                   <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                   THINKING...
                 </>
               ) : (
                 'ANALYZE'
               )}
             </button>
           )}
        </div>
        <div className="min-h-[80px] text-sm text-stone-300 bg-stone-900/80 p-3 rounded border border-stone-800/50 shadow-inner overflow-y-auto max-h-[150px] whitespace-pre-line leading-relaxed font-mono">
          {advisorText || <span className="text-stone-600 italic">"Generals are not born, they are forged..."<br/>Start battle to enable analysis.</span>}
        </div>
      </div>
    </div>
  );
};