import {
  useEventTimer,
  ZkNoidEvent,
  ZkNoidEventType,
} from '@/lib/platform/game_events';
import Image from 'next/image';
import eventBoxImg from '@/public/image/section2/event-box.svg';

export const EventCard = ({
  headText,
  description,
  event,
}: {
  headText: string;
  description: string;
  event: ZkNoidEvent;
}) => {
  const eventCounter = useEventTimer(event);
  const time = `${eventCounter.startsIn.days}d ${
    eventCounter.startsIn.hours
  }h:${eventCounter.startsIn.minutes}m:${Math.trunc(
    eventCounter.startsIn.seconds!
  )}s`;

  return (
    <div className="relative flex flex-col border-left-accent">
      <Image
        src={eventBoxImg}
        alt=""
        className="-z-10 hidden w-full lg:block"
      />
      <div className="absolute left-0 top-0 -z-10 h-full w-full rounded-[5px] border border-left-accent bg-[#252525] lg:hidden" />
      <div
        className={
          'group absolute bottom-2 right-2 z-10 max-[2200px]:bottom-0 max-[2200px]:right-0 max-[2000px]:p-2 max-[1800px]:-right-2 max-[1800px]:bottom-2 max-[1600px]:-right-3 max-[1600px]:bottom-8 max-lg:bottom-0 max-lg:right-0 max-lg:rounded-tl-[5px] max-lg:border-l max-lg:border-t max-lg:border-l-left-accent max-lg:border-t-left-accent max-lg:bg-bg-dark max-lg:p-3 max-lg:pl-4 max-lg:pt-4 lg:rounded-xl lg:bg-[#252525] min-[2000px]:p-4'
        }
      >
        <svg
          width="70"
          height="70"
          viewBox="0 0 43 43"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={'h-[40px] w-[40px] lg:h-auto lg:w-auto'}
        >
          <g clipPath="url(#clip0_2919_5699)">
            <path
              d="M43 6.82096V43H33.3517V16.4687L8.88848 40.9306L2.06715 34.1096L26.5304 9.64775H0V0H36.1787L36.1811 0.00241194L43 6.82096Z"
              fill="#D2FF00"
              className={
                'group-hover:fill-none group-hover:stroke-left-accent group-hover:stroke-2'
              }
            />
            <path d="M36.1816 0V0.00286067L36.1787 0H36.1816Z" fill="#D2FF00" />
          </g>
          <defs>
            <clipPath id="clip0_2919_5699">
              <rect width="43" height="43" fill="white" />
            </clipPath>
          </defs>
        </svg>
      </div>
      <div className="absolute left-0 top-0 flex h-full w-full flex-col p-2 lg:p-5">
        <div className="pb-2 text-[20px]/[20px] font-bold lg:text-headline-2">
          {headText}
        </div>
        <div className="max-w-full font-plexsans text-[14px]/[18px] lg:max-w-[462px] lg:text-main">
          {description}
        </div>
        <div className="flex-grow" />
        <div className="max-w-full text-[20px]/[20px] font-medium lg:max-w-[462px] lg:text-big-uppercase lg:max-[2000px]:pb-4 lg:max-[1600px]:pb-10">
          {eventCounter.type == ZkNoidEventType.UPCOMING_EVENTS && (
            <>START IN {time}</>
          )}
          {eventCounter.type == ZkNoidEventType.CURRENT_EVENTS && (
            <>END IN {time}</>
          )}
        </div>
      </div>
    </div>
  );
};
