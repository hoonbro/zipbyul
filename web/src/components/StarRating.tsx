/** 별점 표시 (목업 stars()) — 채운 별 + 빈 별 합쳐 5칸. */
export default function StarRating({ stars }: { stars: number }) {
  const n = Math.max(0, Math.min(5, stars))
  return (
    <span className="whitespace-nowrap text-xs tracking-wide text-amber">
      {'★'.repeat(n)}
      {'☆'.repeat(5 - n)}
    </span>
  )
}
