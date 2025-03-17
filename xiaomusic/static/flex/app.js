// XiaoMusic Apple Music风格皮肤 - Vue应用
const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      // 界面状态
      showSidebar: false,
      isDarkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      pageTitle: "播放列表",
      searchQuery: "",
      showToast: false,
      toastMessage: "",
      toastType: "alert-info",
      toastTimeout: null,

      // 侧边栏项目
      sidebarItems: [
        { id: "playlists", name: "播放列表", icon: "queue_music" },
        { id: "now_playing", name: "正在播放", icon: "play_circle" },
        { id: "favorites", name: "收藏", icon: "favorite" },
        { id: "history", name: "历史记录", icon: "history" },
      ],
      activeSidebarItem: "playlists",

      // 播放列表数据
      playlists: [],
      playlistsLoaded: false,

      // 播放状态
      currentSong: {},
      playQueue: [],
      currentSongIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      seekPosition: 0,
      volume: 50,
      repeatMode: "off", // 'off', 'all', 'one'
      shuffle: false,

      // 设备ID
      deviceId: "web_device",

      // 定时器
      statusInterval: null,
      progressInterval: null,
    };
  },

  mounted() {
    // 初始化
    this.initTheme();
    this.loadPlaylists();
    this.getPlayingStatus();
    this.getVolume();

    // 设置定时器获取播放状态
    this.statusInterval = setInterval(() => {
      this.getPlayingStatus();
    }, 5000);

    // 设置定时器更新进度
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && this.duration > 0) {
        this.currentTime += 1;
        this.seekPosition = (this.currentTime / this.duration) * 100;

        // 如果播放结束，根据重复模式处理
        if (this.currentTime >= this.duration) {
          if (this.repeatMode === "one") {
            this.currentTime = 0;
          } else if (this.repeatMode === "all" || this.repeatMode === "off") {
            this.playNext();
          }
        }
      }
    }, 1000);

    // 监听窗口大小变化
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  },

  beforeUnmount() {
    // 清除定时器
    clearInterval(this.statusInterval);
    clearInterval(this.progressInterval);

    // 移除事件监听
    window.removeEventListener("resize", this.handleResize);
  },

  methods: {
    // 初始化主题
    initTheme() {
      if (localStorage.getItem("theme") === "dark") {
        this.isDarkMode = true;
        document.documentElement.setAttribute("data-theme", "dark");
      } else if (localStorage.getItem("theme") === "light") {
        this.isDarkMode = false;
        document.documentElement.setAttribute("data-theme", "light");
      }
    },

    // 切换主题
    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      document.documentElement.setAttribute(
        "data-theme",
        this.isDarkMode ? "dark" : "light"
      );
      localStorage.setItem("theme", this.isDarkMode ? "dark" : "light");
    },

    // 处理窗口大小变化
    handleResize() {
      if (window.innerWidth >= 1024) {
        this.showSidebar = true;
      } else {
        this.showSidebar = false;
      }
    },

    // 选择侧边栏项目
    selectSidebarItem(id) {
      this.activeSidebarItem = id;

      // 设置页面标题
      const item = this.sidebarItems.find((item) => item.id === id);
      if (item) {
        this.pageTitle = item.name;
      }

      // 在移动设备上关闭侧边栏
      if (window.innerWidth < 1024) {
        this.showSidebar = false;
      }
    },

    // 加载播放列表
    async loadPlaylists() {
      try {
        // 获取播放列表名称
        const playlistNames = await API.getPlaylistNames();

        // 获取每个播放列表的歌曲
        const playlists = [];
        for (const name of playlistNames) {
          const songs = await API.getPlaylistMusics(name);
          playlists.push({
            name,
            songs,
          });
        }

        this.playlists = playlists;
        this.playlistsLoaded = true;
      } catch (error) {
        console.error("加载播放列表失败:", error);
        this.showToastMessage("加载播放列表失败", "alert-error");
      }
    },

    // 获取当前播放状态
    async getPlayingStatus() {
      try {
        const status = await API.getPlayingStatus(this.deviceId);

        // 更新当前歌曲信息
        if (status.cur_music) {
          // 如果当前歌曲变化，获取详细信息
          if (
            !this.currentSong.title ||
            this.currentSong.title !== status.cur_music
          ) {
            const songInfo = await API.getMusicInfo(status.cur_music);
            this.currentSong = songInfo;

            // 更新播放队列
            if (status.cur_playlist && this.playlists.length > 0) {
              const playlist = this.playlists.find(
                (p) => p.name === status.cur_playlist
              );
              if (playlist) {
                // 获取队列中所有歌曲的详细信息
                const songNames = playlist.songs.map((song) =>
                  typeof song === "string" ? song : song.title
                );
                const songsInfo = await API.getMusicInfos(songNames);

                this.playQueue = songsInfo;

                // 找到当前歌曲在队列中的索引
                this.currentSongIndex = this.playQueue.findIndex(
                  (song) => song.title === status.cur_music
                );
              }
            }
          }

          // 更新播放状态
          this.isPlaying = status.state === "PLAYING";

          // 更新歌曲时长
          if (this.currentSong.duration) {
            this.duration = this.currentSong.duration;
          }
        }
      } catch (error) {
        console.error("获取播放状态失败:", error);
      }
    },

    // 获取音量
    async getVolume() {
      try {
        const response = await API.getVolume(this.deviceId);
        if (response && response.volume !== undefined) {
          this.volume = response.volume;
        }
      } catch (error) {
        console.error("获取音量失败:", error);
      }
    },

    // 设置音量
    async setVolume() {
      try {
        await API.setVolume(this.deviceId, this.volume);
      } catch (error) {
        console.error("设置音量失败:", error);
        this.showToastMessage("设置音量失败", "alert-error");
      }
    },

    // 播放/暂停
    async togglePlay() {
      try {
        if (this.isPlaying) {
          await API.sendCommand(this.deviceId, API.commands.PLAY_PAUSE);
          this.isPlaying = false;
        } else {
          await API.sendCommand(this.deviceId, API.commands.PLAY_CONTINUE);
          this.isPlaying = true;
        }
      } catch (error) {
        console.error("播放/暂停失败:", error);
        this.showToastMessage("播放/暂停失败", "alert-error");
      }
    },

    // 播放上一首
    async playPrevious() {
      try {
        await API.sendCommand(this.deviceId, API.commands.PLAY_PREVIOUS);
        // 状态会通过定时器更新，但为了UI响应更快，手动更新索引
        if (this.currentSongIndex > 0) {
          this.currentSongIndex--;
        } else {
          this.currentSongIndex = this.playQueue.length - 1;
        }
        this.currentTime = 0;
        this.seekPosition = 0;
      } catch (error) {
        console.error("播放上一首失败:", error);
        this.showToastMessage("播放上一首失败", "alert-error");
      }
    },

    // 播放下一首
    async playNext() {
      try {
        await API.sendCommand(this.deviceId, API.commands.PLAY_NEXT);
        // 状态会通过定时器更新，但为了UI响应更快，手动更新索引
        if (this.currentSongIndex < this.playQueue.length - 1) {
          this.currentSongIndex++;
        } else {
          this.currentSongIndex = 0;
        }
        this.currentTime = 0;
        this.seekPosition = 0;
      } catch (error) {
        console.error("播放下一首失败:", error);
        this.showToastMessage("播放下一首失败", "alert-error");
      }
    },

    // 切换重复模式
    async toggleRepeat() {
      if (this.repeatMode === "off") {
        this.repeatMode = "all";
        await API.sendCommand(this.deviceId, API.commands.PLAY_MODE_SEQUENCE);
        this.showToastMessage("全部循环", "alert-info");
      } else if (this.repeatMode === "all") {
        this.repeatMode = "one";
        await API.sendCommand(this.deviceId, API.commands.PLAY_MODE_SINGLE);
        this.showToastMessage("单曲循环", "alert-info");
      } else {
        this.repeatMode = "off";
        await API.sendCommand(this.deviceId, API.commands.PLAY_MODE_SEQUENCE);
        this.showToastMessage("顺序播放", "alert-info");
      }
    },

    // 切换随机播放
    async toggleShuffle() {
      this.shuffle = !this.shuffle;
      if (this.shuffle) {
        await API.sendCommand(this.deviceId, API.commands.PLAY_MODE_RANDOM);
        this.showToastMessage("随机播放", "alert-info");
      } else {
        await API.sendCommand(this.deviceId, API.commands.PLAY_MODE_SEQUENCE);
        this.showToastMessage("顺序播放", "alert-info");
      }
    },

    // 播放歌单
    async playPlaylist(playlistName) {
      try {
        const playlist = this.playlists.find((p) => p.name === playlistName);
        if (playlist && playlist.songs.length > 0) {
          // 获取第一首歌曲
          const firstSong = playlist.songs[0];
          const songName =
            typeof firstSong === "string" ? firstSong : firstSong.title;

          // 播放歌曲
          await API.playMusicFromList(this.deviceId, playlistName, songName);

          // 更新UI
          this.showToastMessage(`正在播放: ${playlistName}`, "alert-success");
          this.selectSidebarItem("now_playing");
        }
      } catch (error) {
        console.error("播放歌单失败:", error);
        this.showToastMessage("播放歌单失败", "alert-error");
      }
    },

    // 播放歌曲
    async playSong(playlistName, song) {
      try {
        const songName = typeof song === "string" ? song : song.title;

        // 播放歌曲
        await API.playMusicFromList(this.deviceId, playlistName, songName);

        // 更新UI
        this.showToastMessage(`正在播放: ${songName}`, "alert-success");
        this.selectSidebarItem("now_playing");
      } catch (error) {
        console.error("播放歌曲失败:", error);
        this.showToastMessage("播放歌曲失败", "alert-error");
      }
    },

    // 从播放队列播放歌曲
    async playSongFromQueue(index) {
      if (index === this.currentSongIndex) {
        // 如果点击当前播放的歌曲，切换播放/暂停
        this.togglePlay();
        return;
      }

      try {
        const song = this.playQueue[index];
        if (song) {
          // 播放歌曲
          await API.playMusicFromList(
            this.deviceId,
            this.currentSong.cur_playlist,
            song.title
          );

          // 更新UI
          this.currentSongIndex = index;
          this.currentTime = 0;
          this.seekPosition = 0;
          this.showToastMessage(`正在播放: ${song.title}`, "alert-success");
        }
      } catch (error) {
        console.error("播放歌曲失败:", error);
        this.showToastMessage("播放歌曲失败", "alert-error");
      }
    },

    // 搜索音乐
    async searchMusic() {
      if (!this.searchQuery.trim()) return;

      try {
        // 这里可以实现搜索功能，根据API提供的能力
        this.showToastMessage(`搜索: ${this.searchQuery}`, "alert-info");
        // 清空搜索框
        this.searchQuery = "";
      } catch (error) {
        console.error("搜索失败:", error);
        this.showToastMessage("搜索失败", "alert-error");
      }
    },

    // 拖动进度条
    seek() {
      // 计算新的播放时间
      const newTime = (this.seekPosition / 100) * this.duration;
      this.currentTime = newTime;

      // 这里可以实现跳转功能，但API似乎没有提供相关能力
      // 所以这里只是更新UI
    },

    // 显示提示消息
    showToastMessage(message, type = "alert-info") {
      // 清除之前的定时器
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }

      // 显示新消息
      this.toastMessage = message;
      this.toastType = type;
      this.showToast = true;

      // 设置定时器自动关闭
      this.toastTimeout = setTimeout(() => {
        this.showToast = false;
      }, 3000);
    },

    // 格式化时间 (秒 -> MM:SS)
    formatTime(seconds) {
      if (!seconds) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    },

    // 格式化时长
    formatDuration(seconds) {
      if (!seconds) return "";
      return this.formatTime(seconds);
    },
  },
});

// 挂载应用
app.mount("#app");
