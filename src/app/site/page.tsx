import s from "./site.module.css";

export default function SitePage() {
  return (
    <div className={s.root}>
      <div className={s.progress} aria-hidden="true" />
    </div>
  );
}
