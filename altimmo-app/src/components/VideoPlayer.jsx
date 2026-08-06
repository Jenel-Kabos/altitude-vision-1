import React, { useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';

function VideoPlayer({
  source,
  style,
  contentFit = 'contain',
  shouldPlay = false,
  isLooping = false,
  nativeControls = false,
  isMuted = false,
}) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = isLooping;
    instance.muted = isMuted;
    if (shouldPlay) instance.play();
  });

  useEffect(() => {
    player.loop = isLooping;
    player.muted = isMuted;
    if (shouldPlay) player.play();
    else player.pause();
  }, [isLooping, isMuted, player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
    />
  );
}

export default React.memo(VideoPlayer);
