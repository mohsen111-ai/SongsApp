package com.songsapp.player;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keeps the CPU awake while a song plays and asks Android not to put the app to sleep. */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {
    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private AudioDeviceCallback deviceCallback;

    @Override
    public void load() {
        super.load();
        if (Build.VERSION.SDK_INT >= 23) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            deviceCallback = new AudioDeviceCallback() {
                @Override public void onAudioDevicesAdded(AudioDeviceInfo[] added) { notifyRoute("added"); }
                @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { notifyRoute("removed"); }
            };
            audioManager.registerAudioDeviceCallback(deviceCallback, new Handler(Looper.getMainLooper()));
        }
    }

    private void notifyRoute(String change) {
        JSObject o = new JSObject();
        o.put("change", change);
        notifyListeners("routeChanged", o);
    }

    @PluginMethod
    public void setPlaying(PluginCall call) {
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        try {
            if (playing) {
                if (wakeLock == null) {
                    PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "drift:playback");
                    wakeLock.setReferenceCounted(false);
                }
                if (!wakeLock.isHeld()) wakeLock.acquire(6 * 60 * 60 * 1000L);
            } else if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        JSObject ret = new JSObject();
        boolean already = false;
        try {
            Context ctx = getContext();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            already = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            if (!already) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
                getActivity().startActivity(i);
            }
        } catch (Exception ignored) { }
        ret.put("granted", already);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) { }
        try { if (Build.VERSION.SDK_INT >= 23 && audioManager != null && deviceCallback != null) audioManager.unregisterAudioDeviceCallback(deviceCallback); } catch (Exception ignored) { }
        super.handleOnDestroy();
    }
}
