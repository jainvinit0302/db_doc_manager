import React, { useState } from 'react';
import Editor from './components/Editor';
import Viewer from './components/Viewer';

export default function App(){
  const [dsl, setDsl] = useState('');
  const [validateResult, setValidateResult] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async (text) => {
    setLoading(true);
    setValidateResult(null);
    setGenerateResult(null);
    try{
      const res = await fetch('/api/validate', { method: 'POST', headers: {'Content-Type':'text/plain'}, body: text });
      const data = await res.json();
      setValidateResult(data);
      return data;
    }catch(e){
      setValidateResult({ error: String(e) });
    }finally{ setLoading(false); }
  };

  const handleGenerate = async (text) => {
    setLoading(true);
    setGenerateResult(null);
    try{
      const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type':'text/plain'}, body: text });
      const data = await res.json();
      setGenerateResult(data);
      return data;
    }catch(e){
      setGenerateResult({ error: String(e) });
    }finally{ setLoading(false); }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>DBDocManager — Playground</h1>
      </header>
      <main className="main-grid">
        <section className="left">
          <Editor
            value={dsl}
            onChange={setDsl}
            onValidate={() => handleValidate(dsl)}
            onGenerate={() => handleGenerate(dsl)}
            loading={loading}
          />
        </section>
        <section className="right">
          <Viewer validateResult={validateResult} generateResult={generateResult} />
        </section>
      </main>
    </div>
  );
}
