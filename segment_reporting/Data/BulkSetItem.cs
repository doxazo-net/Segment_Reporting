namespace segment_reporting.Data
{
    public class BulkSetItem
    {
        public string ItemId { get; set; }
        public long? IntroStartTicks { get; set; }
        public long? IntroEndTicks { get; set; }
        public long? CreditsStartTicks { get; set; }
    }
}
