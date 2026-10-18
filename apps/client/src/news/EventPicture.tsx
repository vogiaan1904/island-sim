import type { SimEvent } from '@island/sim';
import { Icon } from '../ui/icons.tsx';
import { eventPicture } from './words.ts';

/** The small picture of an event: a building rendered from its model, or a line icon. Decorative; the sentence next to it says it. */
export function EventPictureView({ event, size = 32 }: { event: SimEvent; size?: number }) {
  const picture = eventPicture(event);
  if (picture.kind === 'building') {
    return <img className="news-picture-img" src={`/icons/building_${picture.building}_a.png`} alt="" width={size} height={size} draggable={false} />;
  }
  return <Icon name={picture.name} size={Math.round(size * 0.75)} />;
}
