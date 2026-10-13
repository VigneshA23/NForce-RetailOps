package com.nforce.retailops.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

// Pins the JSON the Stock Check screen sends for reported received stock.
class StockCheckSubmitRequestTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void receivedItemsFromTheFrontendBecomeDeliveries() throws Exception {
        String json = "{\"storeId\":1,\"storeInventoryItemId\":2,\"snapshot\":\"END_OF_DAY\",\"available\":5,\"deadStock\":0,"
            + "\"receivedItems\":[{\"orderEntryId\":70,\"quantity\":4},{\"orderEntryId\":null,\"quantity\":1}]}";

        StockCheckSubmitRequest request = mapper.readValue(json, StockCheckSubmitRequest.class);

        assertThat(request.deliveries()).hasSize(2);
        assertThat(request.deliveries().get(0).orderEntryId()).isEqualTo(70L);
        assertThat(request.deliveries().get(0).quantity()).isEqualByComparingTo(new BigDecimal("4"));
        assertThat(request.deliveries().get(1).orderEntryId()).isNull();
    }

    @Test
    void noReceivedStockMeansNoDeliveries() throws Exception {
        String json = "{\"storeId\":1,\"storeInventoryItemId\":2,\"snapshot\":\"END_OF_DAY\",\"available\":5,\"deadStock\":0,\"receivedItems\":null}";

        assertThat(mapper.readValue(json, StockCheckSubmitRequest.class).deliveries()).isEmpty();
    }
}
