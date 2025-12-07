import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BattleEngine } from './classes/BattleEngine';
import { Controls } from './components/Controls';
import { FormationType, Team, UnitType, BattleStats } from './types';
import { getTacticalAdvice } from './services/advisorService';
import { BrainCircuit } from 'lucide-react';

const engine = new BattleEngine();

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Game State
  const [isRunning, setIsRunning] = useState(false);
  const [unitCount, setUnitCount] = useState(150);
  const [mFormat, setMFormat] = useState<FormationType>(FormationType.PHALANX);
  const [eFormat, setEFormat] = useState<FormationType>(FormationType.LINE);
  
  // Advisor State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advisorText, setAdvisorText] = useState("");
  const [battleStats, setBattleStats] = useState<BattleStats | null>(null);

  const renderLoop = useCallback(() => {
    if (isRunning) {
      engine.update();
    }
    engine.draw();
    
    // Update UI stats periodically (every 60 frames approx to save react renders)
    if (isRunning && Math.random() > 0.95) {
       setBattleStats(engine.getStats());
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  }, [isRunning]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        engine.init(ctx, canvas.width, canvas.height);
        // Initial spawn for visual setup
        engine.spawnUnits(unitCount, mFormat, eFormat);
        engine.draw();
      }
      
      const handleResize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          engine.init(ctx!, canvas.width, canvas.height);
          if (!isRunning) engine.draw();
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []); // Only run once on mount

  useEffect(() => {
    // Start loop
    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [renderLoop]);
  
  // Update formations if changed mid-battle
  useEffect(() => {
      if (isRunning) {
          engine.updateFormation(Team.MACEDONIA, mFormat);
      }
  }, [isRunning, mFormat]);

  useEffect(() => {
      if (isRunning) {
          engine.updateFormation(Team.EASTERN, eFormat);
      }
  }, [isRunning, eFormat]);

  const handleStart = () => {
    engine.spawnUnits(unitCount, mFormat, eFormat);
    setIsRunning(true);
    setAdvisorText("");
  };

  const handleReset = () => {
    setIsRunning(false);
    engine.spawnUnits(unitCount, mFormat, eFormat);
    engine.draw();
    setAdvisorText("");
    setBattleStats(null);
  };

  const handleAnalyze = async () => {
    if (!isRunning) return;
    setIsAnalyzing(true);
    const stats = engine.getStats();
    const advice = await getTacticalAdvice(stats);
    setAdvisorText(advice);
    setIsAnalyzing(false);
  };

  return (
    <div className="relative w-full h-screen bg-stone-950 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full block"
      />
      
      <Controls 
        onStart={handleStart}
        onReset={handleReset}
        onAnalyze={handleAnalyze}
        unitCount={unitCount}
        setUnitCount={setUnitCount}
        macedoniaFormation={mFormat}
        setMacedoniaFormation={setMFormat}
        easternFormation={eFormat}
        setEasternFormation={setEFormat}
        isRunning={isRunning}
        isAnalyzing={isAnalyzing}
        advisorText={advisorText}
      />

      {/* Stats Overlay - Top Right */}
      {battleStats && isRunning && (
        <div className="absolute top-4 right-4 bg-stone-900/50 backdrop-blur text-xs p-4 rounded border border-stone-800 text-stone-300 pointer-events-none select-none">
           <div className="mb-2 font-bold cinzel text-stone-400 border-b border-stone-700 pb-1">Battle Metrics</div>
           <div className="flex gap-4">
             <div>
                <div className="text-red-400 font-bold">Macedonia</div>
                <div>Strength: {battleStats.macedoniaCount}</div>
                <div>Morale: {Math.round(battleStats.macedoniaMorale)}%</div>
             </div>
             <div className="w-px bg-stone-700"></div>
             <div>
                <div className="text-purple-400 font-bold">Eastern</div>
                <div>Strength: {battleStats.easternCount}</div>
                <div>Morale: {Math.round(battleStats.easternMorale)}%</div>
             </div>
           </div>
        </div>
      )}
      
      {/* Cinematic Title - Bottom Right (fades out) */}
      {!isRunning && (
        <div className="absolute bottom-10 right-10 text-right opacity-50 pointer-events-none select-none">
          <h1 className="text-6xl text-stone-800 cinzel font-black tracking-widest uppercase">Antiquity</h1>
          <p className="text-stone-600 tracking-[0.5em] text-sm uppercase mt-2">Grimdark Battle Simulator</p>
        </div>
      )}
    </div>
  );
};

export default App;