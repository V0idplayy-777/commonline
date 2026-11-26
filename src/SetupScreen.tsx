import { ArrowRight, Check, Database, ShieldCheck, UsersRound } from "lucide-react";

export default function SetupScreen() {
  return (
    <main className="cl-setup-screen">
      <header className="cl-setup-header">
        <div className="cl-brand-lockup">
          <span className="cl-brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>COMMONLINE</strong><small>UR GAY</small></span>
        </div>
        <span className="cl-setup-status"><i /> DEPLOYMENT NOT CONNECTED</span>
      </header>
      <section className="cl-setup-hero">
        <div className="cl-setup-copy">
          <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> READY FOR DEPLOYMENT</div>
          <h1>UR GAY.</h1>
          <p>You are gay</p>
          <div className="cl-setup-features">
            <span><Check size={15} /> Real-time posts, replies and saves</span>
            <span><Check size={15} /> Username and password accounts</span>
            <span><Check size={15} /> Feeds based on people you follow</span>
          </div>
        </div>
        <div className="cl-setup-card">
          <div className="cl-setup-card-icon"><Database size={20} /></div>
          <div className="cl-section-label">ONE-TIME PROJECT SETUP</div>
          <h2>Connect the Commonline deployment.</h2>
          <p>This step is for the project owner or developer. Commonline members will not need to create or configure a Convex project.</p>
          <ol>
            <li><span>01</span><div><strong>Choose the Convex project</strong><small>Share the project name and the development or production deployment you want to use.</small></div></li>
            <li><span>02</span><div><strong>Provide the deployment URL</strong><small>For the app's public configuration: <code>VITE_CONVEX_URL</code>.</small></div></li>
            <li><span>03</span><div><strong>Authorize deployment access</strong><small>Connect the project owner or invite a developer who can deploy the schema and functions.</small></div></li>
          </ol>
          <div className="cl-setup-security"><ShieldCheck size={16} /><span>No admin key belongs in the browser or in chat. Deployment credentials stay on the server and in the owner's environment.</span></div>
          <a className="cl-setup-doc-link" href="https://dashboard.convex.dev/" target="_blank" rel="noreferrer">Open Convex dashboard <ArrowRight size={14} /></a>
        </div>
      </section>
      <footer className="cl-setup-footer"><span><UsersRound size={14} /> A global network for people and projects</span><span>Empty data. Ready to connect.</span></footer>
    </main>
  );
}
