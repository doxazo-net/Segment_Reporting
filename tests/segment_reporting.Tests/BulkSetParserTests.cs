using segment_reporting.Data;
using Xunit;

namespace segment_reporting.Tests
{
    public class BulkSetParserTests
    {
        [Fact]
        public void Parse_AlignsTicksToItemsByIndex()
        {
            var result = BulkSetParser.Parse("10,20", "100,200", "150,250", "900,950", 500);

            Assert.Null(result.Error);
            Assert.Equal(2, result.Items.Count);
            Assert.Equal("10", result.Items[0].ItemId);
            Assert.Equal(100, result.Items[0].IntroStartTicks);
            Assert.Equal(150, result.Items[0].IntroEndTicks);
            Assert.Equal(900, result.Items[0].CreditsStartTicks);
            Assert.Equal(250, result.Items[1].IntroEndTicks);
        }

        [Fact]
        public void Parse_EmptyToken_LeavesMarkerUntouchedForThatItem()
        {
            var result = BulkSetParser.Parse("10,20", "100,", "", "900,950", 500);

            Assert.Null(result.Error);
            Assert.Equal(100, result.Items[0].IntroStartTicks);
            Assert.Null(result.Items[1].IntroStartTicks);   // empty token
            Assert.Null(result.Items[0].IntroEndTicks);     // whole column empty
            Assert.Null(result.Items[1].IntroEndTicks);
            Assert.Equal(950, result.Items[1].CreditsStartTicks);
        }

        [Fact]
        public void Parse_EmptyItemIds_ReturnsError()
        {
            var result = BulkSetParser.Parse("", "100", null, null, 500);
            Assert.NotNull(result.Error);
            Assert.Null(result.Items);
        }

        [Fact]
        public void Parse_TooManyItems_ReturnsError()
        {
            var result = BulkSetParser.Parse("1,2,3", null, null, null, 2);
            Assert.Contains("Maximum 2", result.Error);
        }

        [Fact]
        public void Parse_TicksCountMismatch_ReturnsError()
        {
            var result = BulkSetParser.Parse("1,2,3", "100,200", null, null, 500);
            Assert.NotNull(result.Error);
            Assert.Contains("IntroStart", result.Error);
        }

        [Fact]
        public void Parse_NegativeTicks_ReturnsError()
        {
            var result = BulkSetParser.Parse("1", "-5", null, null, 500);
            Assert.Contains("non-negative", result.Error);
        }

        [Fact]
        public void Parse_NonNumericTicks_ReturnsError()
        {
            var result = BulkSetParser.Parse("1", "abc", null, null, 500);
            Assert.Contains("Invalid", result.Error);
        }

        [Fact]
        public void Parse_EmptyItemIdToken_ReturnsError()
        {
            var result = BulkSetParser.Parse("1,,3", "100,200,300", null, null, 500);
            Assert.NotNull(result.Error);
            Assert.Null(result.Items);
        }

        [Fact]
        public void Parse_TrailingEmptyItemIdToken_ReturnsError()
        {
            var result = BulkSetParser.Parse("1,3,", null, null, null, 500);
            Assert.NotNull(result.Error);
        }

        [Fact]
        public void Parse_AllTickColumnsEmpty_ReturnsItemsWithNullTicks()
        {
            var result = BulkSetParser.Parse("1,2,3", null, null, null, 500);
            Assert.Null(result.Error);
            Assert.Equal(3, result.Items.Count);
            foreach (var it in result.Items)
            {
                Assert.Null(it.IntroStartTicks);
                Assert.Null(it.IntroEndTicks);
                Assert.Null(it.CreditsStartTicks);
            }
        }
    }
}
