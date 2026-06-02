using System.Collections.Generic;

namespace segment_reporting.Data
{
    public class BulkSetParseResult
    {
        public string Error { get; set; }
        public List<BulkSetItem> Items { get; set; }
    }

    public static class BulkSetParser
    {
        // Parses index-aligned, comma-separated columns into per-item absolute
        // target values. An empty token (or an entirely empty/absent ticks
        // string) means "leave that marker untouched" for that item. Ticks
        // columns are split WITHOUT collapsing empties so index alignment with
        // ItemIds is preserved.
        public static BulkSetParseResult Parse(
            string itemIdsStr,
            string introStartTicksStr,
            string introEndTicksStr,
            string creditsStartTicksStr,
            int maxItems)
        {
            var itemIds = SplitItemIds(itemIdsStr);
            if (itemIds.Count == 0)
            {
                return Err("itemIds is required");
            }
            for (int i = 0; i < itemIds.Count; i++)
            {
                if (itemIds[i].Length == 0)
                {
                    return Err("itemIds contains an empty entry");
                }
            }
            if (itemIds.Count > maxItems)
            {
                return Err("Maximum " + maxItems + " items per batch");
            }

            long?[] introStart;
            long?[] introEnd;
            long?[] creditsStart;
            string parseError;

            if (!TryParseTicks(introStartTicksStr, itemIds.Count, "IntroStart", out introStart, out parseError))
            {
                return Err(parseError);
            }
            if (!TryParseTicks(introEndTicksStr, itemIds.Count, "IntroEnd", out introEnd, out parseError))
            {
                return Err(parseError);
            }
            if (!TryParseTicks(creditsStartTicksStr, itemIds.Count, "CreditsStart", out creditsStart, out parseError))
            {
                return Err(parseError);
            }

            var items = new List<BulkSetItem>(itemIds.Count);
            for (int i = 0; i < itemIds.Count; i++)
            {
                items.Add(new BulkSetItem
                {
                    ItemId = itemIds[i],
                    IntroStartTicks = introStart[i],
                    IntroEndTicks = introEnd[i],
                    CreditsStartTicks = creditsStart[i]
                });
            }

            return new BulkSetParseResult { Items = items };
        }

        private static List<string> SplitItemIds(string input)
        {
            var result = new List<string>();
            if (string.IsNullOrEmpty(input))
            {
                return result;
            }
            foreach (var part in input.Split(','))
            {
                result.Add(part.Trim());
            }
            return result;
        }

        private static bool TryParseTicks(string input, int expectedLength, string markerLabel, out long?[] values, out string error)
        {
            values = new long?[expectedLength];
            error = null;

            if (string.IsNullOrEmpty(input))
            {
                return true; // marker untouched for all items
            }

            var tokens = input.Split(',');
            if (tokens.Length != expectedLength)
            {
                error = markerLabel + " ticks count (" + tokens.Length + ") does not match item count (" + expectedLength + ")";
                return false;
            }

            for (int i = 0; i < tokens.Length; i++)
            {
                var token = tokens[i].Trim();
                if (token.Length == 0)
                {
                    values[i] = null; // untouched for this item
                    continue;
                }

                long ticks;
                if (!long.TryParse(token, out ticks))
                {
                    error = "Invalid " + markerLabel + " ticks value: " + token;
                    return false;
                }
                if (ticks < 0)
                {
                    error = markerLabel + " ticks must be non-negative";
                    return false;
                }
                values[i] = ticks;
            }

            return true;
        }

        private static BulkSetParseResult Err(string message)
        {
            return new BulkSetParseResult { Error = message };
        }
    }
}
