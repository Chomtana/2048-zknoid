import Link from 'next/link';

export const UnsetCompetitionPopup = ({
  setIsVisible,
  gameId,
}: {
  setIsVisible: (isVisible: boolean) => void;
  gameId: string;
}) => {
  return (
    <div className={'flex h-full w-full items-center justify-center px-[10%]'}>
      <div
        className={
          'relative max-w-[600px] rounded-2xl border border-left-accent bg-[#252525] p-4'
        }
      >
        <div
          className={
            'absolute right-5 top-5 h-[40px] w-[40px] cursor-pointer hover:opacity-80'
          }
          onClick={() => setIsVisible(false)}
        >
          <div
            className={
              'absolute bottom-0 left-0 right-0 top-0 m-auto h-[40px] w-1 -rotate-45 bg-left-accent'
            }
          />
          <div
            className={
              'absolute bottom-0 left-0 right-0 top-0 m-auto h-[40px] w-1 rotate-45 bg-left-accent'
            }
          />
        </div>
        <div className={'flex flex-col gap-4 p-12 text-center'}>
          <span className={'text-[20px]/[20px]'}>Choose competition</span>
          <span className={'font-plexsans text-[14px]/[14px]'}>
            In order to play, you need to choose a competition from a list or
            create a new one yourself. After that, you can start playing.
          </span>
          <Link
            className={
              'group mt-8 flex w-full flex-row items-center justify-center gap-4 rounded-[5px] border border-bg-dark bg-middle-accent py-2 text-center text-headline-2 font-medium text-dark-buttons-text hover:border-middle-accent hover:bg-bg-dark hover:text-middle-accent'
            }
            href={`/games/${gameId}/competitions-list`}
          >
            <span className={'text-buttons-menu'}>Choose competition</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
