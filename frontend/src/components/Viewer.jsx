import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import Cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

Cytoscape.use(dagre);

function MermaidRenderer({ code }){
  const ref = useRef();
  useEffect(()=>{
    if(!code) return;
    try{
      mermaid.parse(code); // validate
      mermaid.render('mermaid-output', code, (svgCode) => {
        if(ref.current) ref.current.innerHTML = svgCode;
      });
    }catch(e){
      if(ref.current) ref.current.innerText = 'Mermaid render error: '+String(e);
    }
  },[code]);
  return <div ref={ref}></div>;
}

function LineageRenderer({ data }){
  const containerRef = useRef();
  useEffect(()=>{
    if(!data || !containerRef.current) return;
    const cy = Cytoscape({
      container: containerRef.current,
      elements: (data.nodes||[]).concat((data.edges||[]).map(e=>({ data:{ id:e.id, source:e.from, target:e.to } }))),
      layout: { name: 'dagre' },
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'text-valign':'center', 'background-color':'#1976d2', 'color':'#fff' } },
        { selector: 'edge', style: { 'curve-style':'bezier', 'target-arrow-shape':'triangle' } }
      ]
    });
    return ()=> cy.destroy();
  },[data]);
  return <div ref={containerRef} style={{width:'100%',height:400}} />;
}

export default function Viewer({ validateResult, generateResult }){
  const [tab, setTab] = useState('validation');

  useEffect(()=>{ mermaid.initialize({startOnLoad:false, theme:'default'}); },[]);

  return (
    <div className="card">
      <h2>Results</h2>
      <div className="tabs">
        <button onClick={()=>setTab('validation')} className={tab==='validation'?'active':''}>Validation</button>
        <button onClick={()=>setTab('erd')} className={tab==='erd'?'active':''}>ER Diagram</button>
        <button onClick={()=>setTab('lineage')} className={tab==='lineage'?'active':''}>Lineage</button>
        <button onClick={()=>setTab('csv')} className={tab==='csv'?'active':''}>Mapping CSV</button>
      </div>

      <div className="tab-content">
        {tab==='validation' && (
          <pre className="output">
            {validateResult ? JSON.stringify(validateResult, null, 2) : 'No validation result yet.'}
          </pre>
        )}

        {tab==='erd' && (
          <div className="output">
            {generateResult && generateResult.mermaids && generateResult.mermaids.length>0 ?
              generateResult.mermaids.map((m,idx)=> <div key={idx}><h4>ERD #{idx+1}</h4><MermaidRenderer code={m} /></div>)
              : <div>No ERD generated yet.</div>
            }
          </div>
        )}

        {tab==='lineage' && (
          <div className="output">
            {generateResult && generateResult.lineage ? <LineageRenderer data={generateResult.lineage} /> : <div>No lineage yet.</div>}
          </div>
        )}

        {tab==='csv' && (
          <div className="output">
            {generateResult && generateResult.csv ? <pre>{generateResult.csv}</pre> : <div>No mapping CSV yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
