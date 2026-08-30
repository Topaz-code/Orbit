import { Link } from 'react-router-dom';
import { tokenizeText } from '@/lib/utils';

/** Renders post/comment text with clickable #hashtags, @mentions and links. */
export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  return (
    <p className={className}>
      {tokenizeText(text).map((token, index) => {
        switch (token.type) {
          case 'hashtag':
            return (
              <Link
                key={index}
                to={`/search?q=${encodeURIComponent(token.value)}`}
                className="font-medium text-[#6366f1] hover:underline dark:text-[#a5b4fc]"
              >
                {token.value}
              </Link>
            );
          case 'mention':
            return (
              <Link
                key={index}
                to={`/profile/${token.value.slice(1)}`}
                className="font-medium text-[#6366f1] hover:underline dark:text-[#a5b4fc]"
              >
                {token.value}
              </Link>
            );
          case 'url':
            return (
              <a
                key={index}
                href={token.value}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-[#06b6d4] underline-offset-2 hover:underline"
              >
                {token.value.replace(/^https?:\/\//, '').slice(0, 60)}
                {token.value.replace(/^https?:\/\//, '').length > 60 ? '…' : ''}
              </a>
            );
          default:
            return <span key={index}>{token.value}</span>;
        }
      })}
    </p>
  );
}
