import React from 'react';
import { Composition, Series } from 'remotion';
import { Scene1Crisis } from './scenes/Scene1Crisis';
import { Scene2Breakthrough } from './scenes/Scene2Breakthrough';
import { Scene3NewsHub } from './scenes/Scene3NewsHub';
import { Scene4ProductMatrix } from './scenes/Scene4ProductMatrix';
import { Scene5EarnEconomy } from './scenes/Scene5EarnEconomy';
import { Scene6CallToAction } from './scenes/Scene6CallToAction';

export const MainVideo: React.FC = () => {
  // 30 FPS * 9.5s ≈ 285 frames per scene (Total ≈ 1710 frames = 57 seconds)
  return (
    <Series>
      <Series.Sequence durationInFrames={285}>
        <Scene1Crisis />
      </Series.Sequence>
      <Series.Sequence durationInFrames={285}>
        <Scene2Breakthrough />
      </Series.Sequence>
      <Series.Sequence durationInFrames={285}>
        <Scene3NewsHub />
      </Series.Sequence>
      <Series.Sequence durationInFrames={285}>
        <Scene4ProductMatrix />
      </Series.Sequence>
      <Series.Sequence durationInFrames={285}>
        <Scene5EarnEconomy />
      </Series.Sequence>
      <Series.Sequence durationInFrames={285}>
        <Scene6CallToAction />
      </Series.Sequence>
    </Series>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 Landscape Version (1920x1080) for Web, Pitch Decks & YouTube */}
      <Composition
        id="VeriPulseLandscape"
        component={MainVideo}
        durationInFrames={1710}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
