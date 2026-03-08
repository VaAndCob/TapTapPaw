using System;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Media.Control;

class Program
{
    static async Task Main()
    {
        Console.OutputEncoding = Encoding.UTF8;

        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();

        manager.CurrentSessionChanged += async (s, e) =>
        {
            await EmitCurrentSession(manager);
        };

        // Subscribe to existing session if any
        var current = manager.GetCurrentSession();
        if (current != null)
        {
            SubscribeToSession(current);
            await EmitSession(current);
        }

        // Keep process alive
        await Task.Delay(-1);
    }

    static void SubscribeToSession(GlobalSystemMediaTransportControlsSession session)
    {
        session.MediaPropertiesChanged += async (s, e) =>
        {
            await EmitSession(s);
        };

        session.PlaybackInfoChanged += async (s, e) =>
        {
            await EmitSession(s);
        };
    }

    static async Task EmitCurrentSession(GlobalSystemMediaTransportControlsSessionManager manager)
    {
        var session = manager.GetCurrentSession();

        if (session == null)
        {
            EmitEmpty();
            return;
        }

        SubscribeToSession(session);
        await EmitSession(session);
    }

    static async Task EmitSession(GlobalSystemMediaTransportControlsSession session)
    {
        var media = await session.TryGetMediaPropertiesAsync();
        var playback = session.GetPlaybackInfo();

        int state = 0;
        if (playback.PlaybackStatus ==
            GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
            state = 1;
        else if (playback.PlaybackStatus ==
            GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused)
            state = 2;

        var data = new
        {
            state = state,
            track = media?.Title ?? "",
            artist = media?.Artist ?? "",
            app = session.SourceAppUserModelId ?? ""
        };

        var json = JsonSerializer.Serialize(data);
        Console.WriteLine(json);
    }

    static void EmitEmpty()
    {
        Console.WriteLine("{\"state\":0,\"track\":\"\",\"artist\":\"\",\"app\":\"\"}");
    }
}
